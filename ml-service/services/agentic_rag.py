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
                self._groq_client = Groq(api_key=api_key)
                self._model_name = resolve_groq_model(self._groq_client)
                logger.info(f"AgenticRAG initialized Groq client using model: {self._model_name}")
            except Exception as e:
                logger.warning(f"AgenticRAG could not initialize Groq client: {e}")
                self._groq_client = None

    def query(
        self,
        user_id: str,
        query: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        card_ids_filter: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Executes the full Agentic RAG pipeline:
        1. Generates 384d embedding for user query.
        2. Retrieves top vector candidates from PostgreSQL pgvector.
        3. Traverses graph_edges to pull 1st-hop topological neighbors.
        4. Re-ranks cards by fused similarity and PageRank centrality.
        5. Synthesizes a grounded answer with strict inline citations.
        6. Runs automated hallucination self-verification.
        """
        conn = None
        try:
            # 1. Generate query embedding
            query_vec = model_loader.model.encode(query, normalize_embeddings=True).tolist()
            query_vec_str = f"[{','.join(str(round(x, 6)) for x in query_vec)}]"

            conn = vector_store.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # 2. Hybrid Retrieval: Vector similarity + FTS
                filter_clause = ""
                params: List[Any] = [user_id, query_vec_str, query]
                if card_ids_filter and len(card_ids_filter) > 0:
                    filter_clause = "AND c.id = ANY(%s::uuid[])"
                    params.append(card_ids_filter)

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
                    ORDER BY (1 - (c.embedding <=> %s::vector)) DESC
                    LIMIT 8;
                """
                
                # Align parameters
                query_params = [query_vec_str, query, user_id]
                if card_ids_filter and len(card_ids_filter) > 0:
                    query_params.append(card_ids_filter)
                query_params.append(query_vec_str)

                cur.execute(retrieval_sql, tuple(query_params))
                primary_cards = cur.fetchall()

            if not primary_cards:
                return {
                    "query": query,
                    "answer": "I could not find any relevant knowledge cards in your workspace to answer this question. Please make sure you have added notes or documents.",
                    "citations": [],
                    "verification": {
                        "grounded": False,
                        "confidence": 0.0,
                        "unsupported_claims": [],
                        "explanation": "No matching knowledge cards found."
                    },
                    "retrieved_cards_count": 0,
                    "graph_expansion_used": False
                }

            # 3. Graph Traversal Context Expansion: Pull 1st-hop graph neighbors
            candidate_map: Dict[str, Dict[str, Any]] = {str(c["id"]): c for c in primary_cards}
            top_primary_ids = [str(c["id"]) for c in primary_cards[:3]]

            graph_expansion_used = False
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
                            0.50 AS vector_similarity,
                            0.0 AS text_rank,
                            '[]'::json AS tags
                        FROM cards c
                        WHERE c.id = ANY(%s::uuid[]) AND c.user_id = %s;
                        """,
                        (neighbor_ids_to_fetch, user_id)
                    )
                    extra_cards = cur.fetchall()
                    for ec in extra_cards:
                        candidate_map[str(ec["id"])] = ec
                        graph_expansion_used = True

            # 4. Re-ranking: Fused score = (0.75 * similarity) + (0.25 * centrality)
            ranked_cards = list(candidate_map.values())
            for c in ranked_cards:
                sim = float(c.get("vector_similarity") or 0.50)
                cent = float(c.get("centrality") or 0.0)
                c["fused_score"] = round((0.75 * sim) + (0.25 * cent), 4)

            ranked_cards.sort(key=lambda x: x["fused_score"], reverse=True)
            context_cards = ranked_cards[:6]

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
        # Build structured context block
        context_blocks = []
        for c in context_cards:
            cid = str(c["id"])
            title = c["title"]
            content = (c.get("extracted_text") or c.get("raw_content") or c.get("snippet") or "")[:800]
            context_blocks.append(f"CARD ID: {cid}\nCARD TITLE: {title}\nCARD CONTENT:\n{content}")

        joined_context = "\n\n---\n\n".join(context_blocks)

        system_prompt = (
            "You are LinkUp's Agentic Retrieval-Augmented Generation (RAG) knowledge assistant.\n"
            "Your mission is to provide accurate, comprehensive, and strictly grounded answers using ONLY the provided knowledge cards.\n\n"
            "CRITICAL CITATION RULES:\n"
            "1. Every factual statement or claim MUST include an inline citation markup in this EXACT format:\n"
            "   [Card: <card_id> - <card_title>]\n"
            "2. Do NOT invent card IDs or titles. Use only the exact IDs and titles from the context.\n"
            "3. If the knowledge cards do not contain information to answer the question, clearly state: "
            "'Based on your knowledge cards, there is not enough information to answer this question.'\n"
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
                    max_tokens=800,
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
