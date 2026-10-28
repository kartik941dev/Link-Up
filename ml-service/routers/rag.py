import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from services.agentic_rag import agentic_rag

logger = logging.getLogger("ml_service.rag_router")

router = APIRouter(prefix="/rag", tags=["Agentic RAG & Chat"])

class MessageItem(BaseModel):
    role: str = Field(..., description="Role: 'user' or 'assistant'")
    content: str = Field(..., description="Message text content")

class RAGQueryRequest(BaseModel):
    user_id: str = Field(..., description="UUID of the authenticated user")
    query: str = Field(..., min_length=2, max_length=2000, description="User's natural language question")
    conversation_history: Optional[List[MessageItem]] = Field(
        default=None,
        description="Optional preceding conversation turns for contextual multi-hop reasoning"
    )
    card_ids_filter: Optional[List[str]] = Field(
        default=None,
        description="Optional list of specific card IDs to constrain the retrieval scope"
    )

@router.post("/query", summary="Execute Agentic RAG multi-hop retrieval and grounded answer synthesis")
async def rag_query_endpoint(req: RAGQueryRequest):
    """
    Performs hybrid vector + full-text search, graph topology neighborhood expansion,
    strict citation generation via Groq Llama 3.1, and automated hallucination self-verification.
    """
    try:
        history_dicts = None
        if req.conversation_history:
            history_dicts = [{"role": m.role, "content": m.content} for m in req.conversation_history]

        result = agentic_rag.query(
            user_id=req.user_id,
            query=req.query,
            conversation_history=history_dicts,
            card_ids_filter=req.card_ids_filter
        )
        return result
    except Exception as e:
        logger.error(f"RAG query failed for user {req.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agentic RAG pipeline failed: {str(e)}"
        )
