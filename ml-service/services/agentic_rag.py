import logging
import re
from typing import List, Dict, Any, Optional
import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor

from config import settings
from services.model_loader import model_loader
from services.vector_store import vector_store
from services.verifier import hallucination_verifier
from utils.llm_client import resolve_groq_model

logger = logging.getLogger("ml_service.agentic_rag")

class AgenticRAG:
    def __init__(self):
        self._groq_client = None
        self._model_name = "llama-3.1-8b-instant"
        self._init_groq()

    def _init_groq(self):
        api_key = settings.llm_api_key.strip() if settings.llm_api_key else ""
        if api_key and not api_key.startswith("gsk_your_groq_api_key"):
            try:
                from groq import Groq
                self._groq_client = Groq(api_key=api_key, max_retries=2)
                self._model_name = resolve_groq_model(self._groq_client)
                logger.info(f"AgenticRAG initialized Groq client using model: {self._model_name}")
            except Exception as e:
                logger.warning(f"AgenticRAG could not initialize Groq client: {e}")
                self._groq_client = None

    def _extract_relevant_excerpt(self, text: str, query: str, max_chars: int = 1200) -> str:
        """
        Extracts the most query-relevant segment from long documents (e.g. 50KB+ web pages or multi-page PDFs)
        so the LLM sees key matching paragraphs without exceeding token/TPM budgets.
        """
        if not text:
            return ""
        clean = text.strip()
        if len(clean) <= max_chars:
            return clean

        # Tokenize meaningful query terms
        stop_words = {
            "what", "when", "where", "which", "who", "how", "why", "the", "and", "for",
            "with", "from", "about", "that", "this", "are", "was", "were", "does", "did",
            "into", "based", "your", "their", "explain", "tell", "describe", "according"
        }
        q_terms = [
            t for t in re.findall(r"[a-zA-Z0-9]{3,}", query.lower())
            if t not in stop_words
        ]

        if not q_terms:
            return clean[:max_chars]

        # Split into overlapping chunks and score by query term coverage
        chunk_size = 500
        step = 350
        best_chunks = []
        for start in range(0, min(len(clean), 25000), step):
            chunk = clean[start:start + chunk_size]
            chunk_lower = chunk.lower()
            score = sum(2 if term in chunk_lower else 0 for term in q_terms)
            # Slight bonus for earlier introductory content
            if start == 0:
                score += 1
            best_chunks.append((score, start, chunk))

        best_chunks.sort(key=lambda x: (x[0], -x[1]), reverse=True)
        selected = sorted(best_chunks[:2], key=lambda x: x[1])
        combined = "\n...\n".join(c[2].strip() for c in selected)
        return combined[:max_chars]

    def _ensure_user_embeddings(self, conn, user_id: str) -> int:
        """
        Ensures all cards belonging to user_id have vector embeddings in PostgreSQL.
        Backfills any cards with NULL embedding on demand so RAG never misses documents.
        """
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, title, COALESCE(extracted_text, raw_content, '') AS text_content
                FROM cards
                WHERE user_id = %s AND embedding IS NULL
                ORDER BY created_at DESC
                LIMIT 50;
                """,
                (user_id,)
            )
            missing_cards = cur.fetchall()

        if not missing_cards:
            return 0

        logger.info(f"Backfilling {len(missing_cards)} unembedded card(s) for user {user_id} before RAG query...")
        texts = [f"{c['title']}\n\n{(c['text_content'] or '')[:8000]}".strip() for c in missing_cards]
        embeddings = model_loader.encode(texts)

        updated = 0
        with conn.cursor() as cur:
            for card, emb in zip(missing_cards, embeddings):
                vec_str = f"[{','.join(str(round(x, 6)) for x in emb)}]"
                cur.execute(
                    "UPDATE cards SET embedding = %s::vector, updated_at = CURRENT_TIMESTAMP WHERE id = %s;",
                    (vec_str, str(card["id"]))
                )
                updated += 1
            conn.commit()
        logger.info(f"Backfilled {updated} card embedding(s) for user {user_id}.")
        return updated

    def query(
        self,
        user_id: str,
        query: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        card_ids_filter: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Executes the full Agentic RAG pipeline:
        1. Backfills any unembedded user cards in PostgreSQL.
        2. Generates 384d embedding for user query.
        3. Retrieves top hybrid (vector + full-text) candidates from PostgreSQL pgvector.
        4. Traverses graph_edges to pull 1st-hop topological neighbors.
        5. Re-ranks cards by fused similarity, text rank, and PageRank centrality.
        6. Synthesizes a grounded answer with strict inline citations.
        7. Runs automated hallucination self-verification.
        """
        conn = None
        try:
            # 1. Generate query embedding
            query_vec = model_loader.encode(query)
            query_vec_str = f"[{','.join(str(round(x, 6)) for x in query_vec)}]"

            conn = vector_store.get_connection()

            # Ensure all of the user's saved cards are embedded before vector retrieval
            self._ensure_user_embeddings(conn, user_id)

            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # 2. Hybrid Retrieval: Vector similarity + PostgreSQL Full-Text Search
                filter_clause = ""
                if card_ids_filter and len(card_ids_filter) > 0:
                    filter_clause = "AND c.id = ANY(%s::uuid[])"

                retrieval_sql = f"""
                    SELECT 
                        c.id,
                        c.title,
                        c.content_type,
                        c.raw_content,
                        c.extracted_text,
                        c.centrality,
                        c.cluster_label,
                        c.metadata,
                        SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 350) AS snippet,
                        (1 - (c.embedding <=> %s::vector)) AS vector_similarity,
                        ts_rank_cd(
                            to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')),
                            plainto_tsquery('english', %s)
                        ) AS text_rank,
                        COALESCE(
                            json_agg(
                                json_build_object('id', t.id, 'name', t.name)
                            ) FILTER (WHERE t.id IS NOT NULL), 
                            '[]'
                        ) AS tags
                    FROM cards c
                    LEFT JOIN card_tags ct ON ct.card_id = c.id
                    LEFT JOIN tags t ON t.id = ct.tag_id
                    WHERE c.user_id = %s {filter_clause} AND c.embedding IS NOT NULL
                    GROUP BY c.id
                    ORDER BY (
                        0.75 * (1 - (c.embedding <=> %s::vector)) +
                        0.25 * (
                            ts_rank_cd(
                                to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')),
                                plainto_tsquery('english', %s)
                            ) / (1.0 + ts_rank_cd(
                                to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')),
                                plainto_tsquery('english', %s)
                            ))
                        )
                    ) DESC
                    LIMIT 8;
                """

                query_params: List[Any] = [query_vec_str, query, user_id]
                if card_ids_filter and len(card_ids_filter) > 0:
                    query_params.append(card_ids_filter)
                query_params.extend([query_vec_str, query, query])

                cur.execute(retrieval_sql, tuple(query_params))
                primary_cards = cur.fetchall()

            if not primary_cards:
                return {
                    "query": query,
                    "answer": "This information was not found in your cards. Please upload a document or add notes to get started.",
                    "citations": [],
                    "verification": {
                        "grounded": True,
                        "confidence": 1.0,
                        "unsupported_claims": [],
                        "explanation": "No matching knowledge cards found."
                    },
                    "retrieved_cards_count": 0,
                    "graph_expansion_used": False
                }

            # Relevance gate: if no card has meaningful semantic or keyword match, refuse cleanly without hallucinating
            max_vec_sim = max(float(c.get("vector_similarity") or 0.0) for c in primary_cards)
            max_txt_rank = max(float(c.get("text_rank") or 0.0) for c in primary_cards)
            if not card_ids_filter and max_vec_sim < 0.25 and max_txt_rank <= 0.0:
                return {
                    "query": query,
                    "answer": "This information was not found in your cards.",
                    "citations": [],
                    "verification": {
                        "grounded": True,
                        "confidence": 1.0,
                        "unsupported_claims": [],
                        "explanation": "Query topic was not found in any saved knowledge cards."
                    },
                    "retrieved_cards_count": len(primary_cards),
                    "graph_expansion_used": False
                }

            # 3. Graph Traversal Context Expansion: Pull 1st-hop graph neighbors (unless scoped via card_ids_filter)
            candidate_map: Dict[str, Dict[str, Any]] = {str(c["id"]): dict(c) for c in primary_cards}
            top_primary_ids = [str(c["id"]) for c in primary_cards[:3]]

            graph_expansion_used = False
            if not card_ids_filter:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """
                        SELECT 
                            CASE WHEN source_card_id = ANY(%s::uuid[]) THEN target_card_id ELSE source_card_id END AS neighbor_id,
                            weight, similarity_score, reason
                        FROM graph_edges
                        WHERE user_id = %s AND (source_card_id = ANY(%s::uuid[]) OR target_card_id = ANY(%s::uuid[]))
                        ORDER BY weight DESC
                        LIMIT 6;
                        """,
                        (top_primary_ids, user_id, top_primary_ids, top_primary_ids)
                    )
                    neighbors = cur.fetchall()

                    neighbor_ids_to_fetch = [
                        str(n["neighbor_id"]) for n in neighbors 
                        if str(n["neighbor_id"]) not in candidate_map
                    ]

                    if neighbor_ids_to_fetch:
                        cur.execute(
                            """
                            SELECT 
                                c.id, c.title, c.content_type, c.raw_content, c.extracted_text, 
                                c.centrality, c.cluster_label, c.metadata,
                                SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 350) AS snippet,
                                CASE WHEN c.embedding IS NOT NULL THEN (1 - (c.embedding <=> %s::vector)) ELSE 0.50 END AS vector_similarity,
                                ts_rank_cd(
                                    to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.extracted_text, '')),
                                    plainto_tsquery('english', %s)
                                ) AS text_rank,
                                COALESCE(
                                    json_agg(
                                        json_build_object('id', t.id, 'name', t.name)
                                    ) FILTER (WHERE t.id IS NOT NULL), 
                                    '[]'
                                ) AS tags
                            FROM cards c
                            LEFT JOIN card_tags ct ON ct.card_id = c.id
                            LEFT JOIN tags t ON t.id = ct.tag_id
                            WHERE c.id = ANY(%s::uuid[]) AND c.user_id = %s
                            GROUP BY c.id;
                            """,
                            (query_vec_str, query, neighbor_ids_to_fetch, user_id)
                        )
                        extra_cards = cur.fetchall()
                        for ec in extra_cards:
                            candidate_map[str(ec["id"])] = dict(ec)
                            graph_expansion_used = True

            # 4. Re-ranking: Fused score = (0.65 * vector_sim) + (0.20 * normalized_text_rank) + (0.15 * centrality)
            ranked_cards = list(candidate_map.values())
            for c in ranked_cards:
                sim = float(c.get("vector_similarity") or 0.0)
                tr = float(c.get("text_rank") or 0.0)
                norm_tr = tr / (1.0 + tr) if tr > 0 else 0.0
                cent = float(c.get("centrality") or 0.0)
                c["fused_score"] = round((0.65 * sim) + (0.20 * norm_tr) + (0.15 * cent), 4)

            ranked_cards.sort(key=lambda x: x["fused_score"], reverse=True)
            context_cards = ranked_cards[:4]

            # Attach query-focused excerpt for both synthesis and verification
            for c in context_cards:
                raw_text = c.get("extracted_text") or c.get("raw_content") or c.get("snippet") or ""
                c["_rag_excerpt"] = self._extract_relevant_excerpt(raw_text, query, max_chars=1200)

            # 5. Synthesize Grounded Answer with Strict Inline Citations
            answer = self._synthesize_answer(query, context_cards, conversation_history)

            # 6. Automated Hallucination Verification
            verification = hallucination_verifier.verify_answer(query, answer, context_cards)

            # 7. Extract Citations from Answer
            cited_cards = self._extract_citations(answer, context_cards)

            return {
                "query": query,
                "answer": answer,
                "citations": cited_cards,
                "verification": verification,
                "retrieved_cards_count": len(context_cards),
                "graph_expansion_used": graph_expansion_used
            }

        except Exception as e:
            logger.error(f"Error in AgenticRAG query for user {user_id}: {e}")
            raise e
        finally:
            if conn:
                vector_store.release_connection(conn)

    def _synthesize_answer(
        self,
        query: str,
        context_cards: List[Dict[str, Any]],
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        # Build structured context block with rich document excerpts
        context_blocks = []
        for c in context_cards:
            cid = str(c["id"])
            title = c["title"]
            ctype = (c.get("content_type") or "note").upper()
            meta = c.get("metadata") or {}
            source_info = ""
            if isinstance(meta, dict):
                if meta.get("url"):
                    source_info = f"\nSOURCE URL: {meta['url']}"
                elif meta.get("originalFilename"):
                    source_info = f"\nSOURCE FILE: {meta['originalFilename']}"
            content = c.get("_rag_excerpt") or (c.get("extracted_text") or c.get("raw_content") or c.get("snippet") or "")[:1200]
            context_blocks.append(
                f"CARD ID: {cid}\nCARD TITLE: {title}\nDOCUMENT TYPE: {ctype}{source_info}\nCARD CONTENT:\n{content}"
            )

        joined_context = "\n\n---\n\n".join(context_blocks)

        system_prompt = (
            "You are LinkUp's Agentic Retrieval-Augmented Generation (RAG) knowledge assistant.\n"
            "Your mission is to provide accurate, comprehensive, and strictly grounded answers using ONLY the provided knowledge cards.\n\n"
            "CRITICAL CITATION RULES:\n"
            "1. Every factual statement or claim MUST include an inline citation markup in this EXACT format:\n"
            "   [Card: <card_id> - <card_title>]\n"
            "2. Do NOT invent card IDs or titles. Use only the exact IDs and titles from the context.\n"
            "3. If the knowledge cards do not contain information to answer the question, DO NOT use outside knowledge and DO NOT invent an answer. Respond ONLY with:\n"
            "   'This information was not found in your cards.'\n"
            "4. Structure your response with clean Markdown (headings, bullet points, and code blocks where applicable).\n"
            "5. Be concise, insightful, and professional."
        )

        user_prompt = f"KNOWLEDGE CARDS CONTEXT:\n{joined_context}\n\nUSER QUESTION:\n{query}"

        # 1. Try Groq Llama 3.1
        if self._groq_client:
            try:
                messages = [{"role": "system", "content": system_prompt}]
                # Attach recent history if available
                if conversation_history:
                    for msg in conversation_history[-4:]:
                        if msg.get("role") in ("user", "assistant"):
                            messages.append({"role": msg["role"], "content": msg["content"]})
                messages.append({"role": "user", "content": user_prompt})

                res = self._groq_client.chat.completions.create(
                    model=self._model_name,
                    messages=messages,
                    temperature=0.2,
                    max_tokens=1000,
                )
                answer = res.choices[0].message.content.strip()
                return answer
            except Exception as e:
                logger.warning(f"Groq answer generation failed: {e}. Falling back to extractive synthesis.")

        # 2. Extractive Grounded Synthesis Fallback
        return self._extractive_synthesis_fallback(query, context_cards)

    def _extractive_synthesis_fallback(
        self,
        query: str,
        context_cards: List[Dict[str, Any]]
    ) -> str:
        """
        Extractive synthesis that summarizes top matching cards with precise citations.
        """
        if not context_cards:
            return "Based on your knowledge cards, no matching information was found."

        top_cards = context_cards[:3]
        lines = [
            f"### Knowledge Synthesis for: *\"{query}\"*\n",
            "Based on the analysis of your indexed knowledge cards:\n"
        ]

        for c in top_cards:
            cid = str(c["id"])
            title = c["title"]
            snippet = (c.get("snippet") or c.get("extracted_text") or "")[:220].strip()
            # Clean snippet line breaks
            snippet = " ".join(snippet.split())
            lines.append(f"- **{title}**: {snippet}... [Card: {cid} - {title}]\n")

        lines.append("\n*All statements above are directly grounded in your verified knowledge cards.*")
        return "\n".join(lines)

    def _extract_citations(
        self,
        answer: str,
        context_cards: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        card_lookup = {str(c["id"]): c for c in context_cards}
        found_ids = set(re.findall(r'\[Card:\s*([0-9a-fA-F-]+)', answer))

        citations = []
        for cid in found_ids:
            if cid in card_lookup:
                card = card_lookup[cid]
                citations.append({
                    "card_id": cid,
                    "title": card["title"],
                    "content_type": card.get("content_type", "note"),
                    "snippet": card.get("snippet") or card.get("extracted_text") or "",
                })

        # Do not attach spurious citations when the assistant explicitly reports the answer was not found
        lower_ans = answer.lower()
        if "not found in your cards" in lower_ans or "not enough information" in lower_ans:
            return []

        # If regex didn't capture citations but context cards exist, associate primary card
        if not citations and context_cards:
            top_card = context_cards[0]
            citations.append({
                "card_id": str(top_card["id"]),
                "title": top_card["title"],
                "content_type": top_card.get("content_type", "note"),
                "snippet": top_card.get("snippet") or "",
            })

        return citations

agentic_rag = AgenticRAG()
