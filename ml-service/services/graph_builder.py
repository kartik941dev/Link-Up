import logging
from typing import List, Dict, Any, Optional
import numpy as np
import networkx as nx
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from services.vector_store import vector_store

logger = logging.getLogger("ml_service.graph_builder")

class GraphBuilder:
    def __init__(self):
        pass

    def build_user_graph(
        self,
        user_id: str,
        min_similarity: float = 0.60
    ) -> Dict[str, Any]:
        """
        Builds the knowledge graph for a user:
        1. Fetches all cards with embeddings.
        2. Computes pairwise cosine similarity.
        3. Identifies edges exceeding min_similarity.
        4. Calculates PageRank centrality scores using NetworkX.
        5. Persists edges to graph_edges and updates cards.centrality.
        """
        conn = None
        try:
            conn = vector_store.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # 1. Fetch cards with embeddings
                cur.execute(
                    """
                    SELECT id, title, content_type, embedding::text AS embedding_str
                    FROM cards
                    WHERE user_id = %s AND embedding IS NOT NULL
                    ORDER BY created_at ASC;
                    """,
                    (user_id,)
                )
                cards = cur.fetchall()

            if not cards:
                logger.info(f"No embedded cards found for user {user_id}.")
                self._clear_user_graph(conn, user_id)
                return {
                    "status": "ok",
                    "user_id": user_id,
                    "node_count": 0,
                    "edge_count": 0,
                    "edges": [],
                    "centralities": {}
                }

            card_ids = [str(c["id"]) for c in cards]
            num_cards = len(cards)

            # Parse embeddings into numpy array
            embeddings_list = []
            for c in cards:
                raw_str = c["embedding_str"].strip("[]")
                vec = [float(x.strip()) for x in raw_str.split(",") if x.strip()]
                embeddings_list.append(vec)

            emb_matrix = np.array(embeddings_list, dtype=np.float32)

            # L2 normalize embeddings
            norms = np.linalg.norm(emb_matrix, axis=1, keepdims=True)
            norms[norms == 0] = 1.0
            norm_matrix = emb_matrix / norms

            # Pairwise cosine similarity matrix: (N, N)
            sim_matrix = np.dot(norm_matrix, norm_matrix.T)

            # Extract edges
            edges = []
            nx_graph = nx.Graph()
            for cid in card_ids:
                nx_graph.add_node(cid)

            for i in range(num_cards):
                for j in range(i + 1, num_cards):
                    score = float(sim_matrix[i, j])
                    if score >= min_similarity:
                        src_id = card_ids[i]
                        tgt_id = card_ids[j]

                        # Classify edge type
                        if score >= 0.85:
                            edge_type = "direct_reference"
                        elif score >= 0.72:
                            edge_type = "topic_cluster"
                        else:
                            edge_type = "semantic_similarity"

                        pct = int(round(score * 100))
                        reason = f"Semantic similarity ({pct}%)"

                        edges.append({
                            "source_card_id": src_id,
                            "target_card_id": tgt_id,
                            "weight": round(score, 4),
                            "similarity_score": round(score, 4),
                            "edge_type": edge_type,
                            "reason": reason
                        })

                        nx_graph.add_edge(src_id, tgt_id, weight=score)

            # Calculate PageRank Centrality
            centralities: Dict[str, float] = {}
            if nx_graph.number_of_edges() > 0:
                try:
                    pr = nx.pagerank(nx_graph, weight="weight", alpha=0.85)
                    # Normalize PageRank to 0.0 - 1.0 range
                    max_pr = max(pr.values()) if pr else 1.0
                    min_pr = min(pr.values()) if pr else 0.0
                    spread = max_pr - min_pr

                    for cid in card_ids:
                        raw_val = pr.get(cid, 0.0)
                        if spread > 1e-6:
                            norm_val = 0.1 + 0.9 * ((raw_val - min_pr) / spread)
                        else:
                            norm_val = 0.5
                        centralities[cid] = round(float(norm_val), 4)
                except Exception as ex:
                    logger.warning(f"PageRank computation fallback: {ex}")
                    # Degree-based fallback
                    for cid in card_ids:
                        deg = nx_graph.degree(cid)
                        centralities[cid] = round(min(1.0, deg / max(1, num_cards - 1)), 4)
            else:
                for cid in card_ids:
                    centralities[cid] = 0.0

            # Persist to database in a transaction
            with conn.cursor() as cur:
                # Clear old edges for this user
                cur.execute("DELETE FROM graph_edges WHERE user_id = %s;", (user_id,))

                # Insert new edges if any
                if edges:
                    edge_rows = [
                        (
                            user_id,
                            e["source_card_id"],
                            e["target_card_id"],
                            e["weight"],
                            e["similarity_score"],
                            e["edge_type"],
                            e["reason"]
                        )
                        for e in edges
                    ]
                    insert_sql = """
                        INSERT INTO graph_edges (
                            user_id, source_card_id, target_card_id, weight, similarity_score, edge_type, reason
                        ) VALUES %s;
                    """
                    execute_values(cur, insert_sql, edge_rows)

                # Update cards.centrality
                if centralities:
                    update_sql = """
                        UPDATE cards AS c
                        SET centrality = v.centrality, updated_at = CURRENT_TIMESTAMP
                        FROM (VALUES %s) AS v(id, centrality)
                        WHERE c.id = v.id::uuid AND c.user_id = %s;
                    """
                    centrality_rows = [(cid, score) for cid, score in centralities.items()]
                    execute_values(cur, update_sql, centrality_rows, template="(%s, %s)")

                conn.commit()

            logger.info(f"Rebuilt graph for user {user_id}: {num_cards} nodes, {len(edges)} edges.")
            return {
                "status": "ok",
                "user_id": user_id,
                "node_count": num_cards,
                "edge_count": len(edges),
                "edges": edges,
                "centralities": centralities
            }

        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Error building graph for user {user_id}: {e}")
            raise e
        finally:
            if conn:
                vector_store.release_connection(conn)

    def _clear_user_graph(self, conn, user_id: str):
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM graph_edges WHERE user_id = %s;", (user_id,))
                cur.execute("UPDATE cards SET centrality = 0.0 WHERE user_id = %s;", (user_id,))
                conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Error clearing graph for user {user_id}: {e}")

graph_builder = GraphBuilder()
