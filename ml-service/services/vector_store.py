import json
import logging
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from config import settings

logger = logging.getLogger("ml_service.vector_store")

class VectorStore:
    def __init__(self):
        self.db_url = settings.database_url
        self._pool: Optional[pool.SimpleConnectionPool] = None
        self._init_pool()

    def _init_pool(self):
        try:
            self._pool = pool.SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=self.db_url
            )
            logger.info("PostgreSQL connection pool initialized for VectorStore.")
        except Exception as e:
            logger.warning(f"Could not initialize PostgreSQL pool at startup: {e}. Vector search will retry on demand.")
            self._pool = None

    def get_connection(self):
        if self._pool is None:
            self._init_pool()
        if self._pool is None:
            raise ConnectionError("Unable to establish PostgreSQL connection pool.")
        return self._pool.getconn()

    def release_connection(self, conn):
        if self._pool and conn:
            self._pool.putconn(conn)

    def search_similar_cards(
        self,
        user_id: str,
        query_vector: List[float],
        limit: int = 20,
        threshold: float = 0.0
    ) -> List[Dict[str, Any]]:
        """
        Executes pgvector cosine similarity search against cards owned by user_id.
        Cosine similarity = 1 - (embedding <=> query_vector)
        """
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                vector_str = "[" + ",".join(str(x) for x in query_vector) + "]"

                sql = """
                    SELECT 
                        c.id,
                        c.user_id,
                        c.title,
                        c.content_type,
                        c.metadata,
                        c.centrality,
                        c.cluster_label,
                        c.created_at,
                        SUBSTRING(COALESCE(c.extracted_text, c.raw_content, ''), 1, 300) AS snippet,
                        (1 - (c.embedding <=> %s::vector)) AS similarity_score,
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
                      AND c.embedding IS NOT NULL
                    GROUP BY c.id
                    HAVING (1 - (c.embedding <=> %s::vector)) >= %s
                    ORDER BY (c.embedding <=> %s::vector) ASC
                    LIMIT %s;
                """

                cur.execute(sql, (vector_str, user_id, vector_str, threshold, vector_str, limit))
                results = cur.fetchall()
                return [dict(r) for r in results]
        except Exception as e:
            logger.error(f"Error executing vector similarity search: {e}")
            raise e
        finally:
            if conn:
                self.release_connection(conn)

    def update_card_embedding(self, card_id: str, embedding: List[float]) -> bool:
        """
        Updates the dense vector embedding for a specific card.
        """
        conn = None
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                vector_str = "[" + ",".join(str(x) for x in embedding) + "]"
                cur.execute(
                    "UPDATE cards SET embedding = %s::vector, updated_at = CURRENT_TIMESTAMP WHERE id = %s RETURNING id;",
                    (vector_str, card_id)
                )
                conn.commit()
                return cur.fetchone() is not None
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Error updating card embedding for {card_id}: {e}")
            raise e
        finally:
            if conn:
                self.release_connection(conn)

    def is_connected(self) -> bool:
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
            self.release_connection(conn)
            return True
        except Exception:
            return False

vector_store = VectorStore()
