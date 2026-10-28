import logging
from typing import List, Dict, Any, Optional
from collections import Counter
import numpy as np
import networkx as nx
from sklearn.cluster import AgglomerativeClustering
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

from services.vector_store import vector_store
from utils.llm_client import llm_client

logger = logging.getLogger("ml_service.clusterer")

class SmartClusterer:
    def __init__(self):
        pass

    def cluster_user_cards(
        self,
        user_id: str,
        min_cluster_similarity: float = 0.35
    ) -> Dict[str, Any]:
        """
        Clusters a user's knowledge cards into thematic communities:
        1. Fetches cards, embeddings, and tags from PostgreSQL.
        2. Computes pairwise cosine similarity matrix.
        3. Detects communities using Louvain / Agglomerative semantic clustering.
        4. Isolates low-similarity outliers into 'Uncategorized Notes'.
        5. Generates human-meaningful thematic titles using Groq LLM.
        6. Updates `cards.cluster_label` in PostgreSQL.
        7. Returns the structured clusters payload.
        """
        conn = None
        try:
            conn = vector_store.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # 1. Fetch user's cards and tags
                cur.execute(
                    """
                    SELECT 
                        c.id,
                        c.user_id,
                        c.title,
                        c.content_type,
                        c.metadata,
                        c.centrality,
                        c.cluster_label,
                        c.created_at,
                        c.updated_at,
                        SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 280) AS snippet,
                        c.embedding::text AS embedding_str,
                        COALESCE(
                            json_agg(
                                json_build_object('id', t.id, 'name', t.name)
                            ) FILTER (WHERE t.id IS NOT NULL), 
                            '[]'
                        ) AS tags
                    FROM cards c
                    LEFT JOIN card_tags ct ON ct.card_id = c.id
                    LEFT JOIN tags t ON t.id = ct.tag_id
                    WHERE c.user_id = %s
                    GROUP BY c.id
                    ORDER BY c.created_at DESC;
                    """,
                    (user_id,)
                )
                cards = cur.fetchall()

            if not cards:
                logger.info(f"No cards found to cluster for user {user_id}.")
                return {
                    "status": "ok",
                    "user_id": user_id,
                    "total_cards": 0,
                    "clusters_count": 0,
                    "clusters": []
                }

            num_cards = len(cards)
            card_map = {str(c["id"]): c for c in cards}

            # If 1 or 2 cards, put them in a single natural cluster
            if num_cards <= 2:
                titles = [c["title"] for c in cards]
                cluster_name = llm_client.generate_cluster_title(titles)
                self._update_card_clusters(conn, user_id, {cid: cluster_name for cid in card_map.keys()})
                
                formatted_cards = [self._format_card_payload(c, cluster_name) for c in cards]
                return {
                    "status": "ok",
                    "user_id": user_id,
                    "total_cards": num_cards,
                    "clusters_count": 1,
                    "clusters": [
                        {
                            "id": "cluster-1",
                            "name": cluster_name,
                            "card_count": num_cards,
                            "common_tags": self._extract_common_tags(cards),
                            "cards": formatted_cards
                        }
                    ]
                }

            # Parse embeddings
            card_ids = []
            embeddings_list = []
            unembedded_card_ids = []

            for c in cards:
                cid = str(c["id"])
                if c["embedding_str"]:
                    raw_str = c["embedding_str"].strip("[]")
                    vec = [float(x.strip()) for x in raw_str.split(",") if x.strip()]
                    if len(vec) == 384:
                        card_ids.append(cid)
                        embeddings_list.append(vec)
                        continue
                unembedded_card_ids.append(cid)

            # Build semantic clusters
            clusters_dict: Dict[int, List[str]] = {}
            outlier_ids: List[str] = list(unembedded_card_ids)

            if len(embeddings_list) >= 2:
                emb_matrix = np.array(embeddings_list, dtype=np.float32)
                # L2 normalize
                norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
                norms[norms == 0] = 1.0
                norm_matrix = emb_matrix / norms

                # Cosine distance = 1 - cosine similarity
                sim_matrix = np.dot(norm_matrix, norm_matrix.T)

                # Attempt Louvain community detection on cosine similarity graph
                G = nx.Graph()
                for cid in card_ids:
                    G.add_node(cid)

                edge_count = 0
                for i in range(len(card_ids)):
                    for j in range(i + 1, len(card_ids)):
                        sim = float(sim_matrix[i, j])
                        if sim >= min_cluster_similarity:
                            G.add_edge(card_ids[i], card_ids[j], weight=sim)
                            edge_count += 1

                if edge_count >= 1:
                    # Community detection via Louvain algorithm
                    try:
                        communities = list(nx.community.louvain_communities(G, weight="weight", seed=42))
                        # Communities are sets of node IDs
                        cluster_idx = 0
                        for comm in communities:
                            comm_list = list(comm)
                            if len(comm_list) == 1:
                                # Check if connected to anything
                                node = comm_list[0]
                                if G.degree(node) == 0:
                                    outlier_ids.append(node)
                                    continue
                            clusters_dict[cluster_idx] = comm_list
                            cluster_idx += 1
                    except Exception as ex:
                        logger.warning(f"Louvain clustering failed: {ex}. Using Agglomerative.")
                        clusters_dict = self._fallback_agglomerative(norm_matrix, card_ids, min_cluster_similarity, outlier_ids)
                else:
                    # Agglomerative clustering fallback
                    clusters_dict = self._fallback_agglomerative(norm_matrix, card_ids, min_cluster_similarity, outlier_ids)
            else:
                # If only 1 embedded card
                if card_ids:
                    outlier_ids.extend(card_ids)

            # Assign cluster names & prepare results
            final_clusters = []
            db_cluster_assignments: Dict[str, str] = {}
            cluster_counter = 1

            for c_idx, members in clusters_dict.items():
                if not members:
                    continue
                member_cards = [card_map[cid] for cid in members if cid in card_map]
                titles = [c["title"] for c in member_cards]
                snippets = [c["snippet"] for c in member_cards]
                common_tags = self._extract_common_tags(member_cards)

                # Generate AI topic title
                cluster_title = llm_client.generate_cluster_title(
                    card_titles=titles,
                    snippets=snippets,
                    common_tags=common_tags
                )

                for cid in members:
                    db_cluster_assignments[cid] = cluster_title

                formatted_cards = [self._format_card_payload(c, cluster_title) for c in member_cards]
                final_clusters.append({
                    "id": f"cluster-{cluster_counter}",
                    "name": cluster_title,
                    "card_count": len(member_cards),
                    "common_tags": common_tags,
                    "cards": formatted_cards
                })
                cluster_counter += 1

            # Handle outliers / uncategorized notes
            if outlier_ids:
                uncat_cards = [card_map[cid] for cid in outlier_ids if cid in card_map]
                uncat_title = "Uncategorized Notes"
                for cid in outlier_ids:
                    db_cluster_assignments[cid] = uncat_title

                formatted_cards = [self._format_card_payload(c, uncat_title) for c in uncat_cards]
                final_clusters.append({
                    "id": f"cluster-{cluster_counter}",
                    "name": uncat_title,
                    "card_count": len(uncat_cards),
                    "common_tags": self._extract_common_tags(uncat_cards),
                    "cards": formatted_cards
                })

            # 5. Persist cluster_label to database in a transaction
            self._update_card_clusters(conn, user_id, db_cluster_assignments)

            logger.info(
                f"Successfully clustered {num_cards} cards for user {user_id} into {len(final_clusters)} thematic groups."
            )

            return {
                "status": "ok",
                "user_id": user_id,
                "total_cards": num_cards,
                "clusters_count": len(final_clusters),
                "clusters": final_clusters
            }

        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Error in SmartClusterer for user {user_id}: {e}")
            raise e
        finally:
            if conn:
                vector_store.release_connection(conn)

    def _fallback_agglomerative(
        self,
        norm_matrix: np.ndarray,
        card_ids: List[str],
        min_cluster_similarity: float,
        outlier_ids: List[str]
    ) -> Dict[int, List[str]]:
        distance_threshold = 1.0 - min_cluster_similarity
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=distance_threshold,
            metric="cosine",
            linkage="average"
        )
        labels = clustering.fit_predict(norm_matrix)
        
        temp_clusters: Dict[int, List[str]] = {}
        for idx, lbl in enumerate(labels):
            temp_clusters.setdefault(int(lbl), []).append(card_ids[idx])

        # Filter out isolated singletons into outlier pool if desired
        result: Dict[int, List[str]] = {}
        r_idx = 0
        for lbl, members in temp_clusters.items():
            if len(members) == 1:
                outlier_ids.append(members[0])
            else:
                result[r_idx] = members
                r_idx += 1
        return result

    def _extract_common_tags(self, cards: List[Dict[str, Any]]) -> List[str]:
        tag_counter = Counter()
        for c in cards:
            tags = c.get("tags") or []
            for t in tags:
                if isinstance(t, dict) and t.get("name"):
                    tag_counter[t["name"]] += 1
        return [tag for tag, _ in tag_counter.most_common(5)]

    def _format_card_payload(self, card_dict: Dict[str, Any], cluster_label: str) -> Dict[str, Any]:
        return {
            "id": str(card_dict["id"]),
            "user_id": str(card_dict["user_id"]),
            "title": card_dict["title"],
            "content_type": card_dict["content_type"],
            "snippet": card_dict.get("snippet") or "",
            "metadata": card_dict.get("metadata") or {},
            "centrality": float(card_dict.get("centrality") or 0.0),
            "cluster_label": cluster_label,
            "created_at": card_dict["created_at"].isoformat() if hasattr(card_dict["created_at"], "isoformat") else str(card_dict["created_at"]),
            "updated_at": card_dict["updated_at"].isoformat() if hasattr(card_dict["updated_at"], "isoformat") else str(card_dict["updated_at"]),
            "tags": card_dict.get("tags") or []
        }

    def _update_card_clusters(self, conn, user_id: str, assignments: Dict[str, str]):
        if not assignments:
            return
        with conn.cursor() as cur:
            update_sql = """
                UPDATE cards AS c
                SET cluster_label = v.cluster_label, updated_at = CURRENT_TIMESTAMP
                FROM (VALUES %s) AS v(id, cluster_label)
                WHERE c.id = v.id::uuid AND c.user_id = %s;
            """
            rows = [(cid, label) for cid, label in assignments.items()]
            execute_values(cur, update_sql, rows, template="(%s, %s)")
            conn.commit()

smart_clusterer = SmartClusterer()
