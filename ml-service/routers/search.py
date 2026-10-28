from typing import List, Optional, Any, Dict
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from services.model_loader import model_loader
from services.vector_store import vector_store

router = APIRouter(prefix="/search", tags=["Vector Search"])

class VectorSearchRequest(BaseModel):
    user_id: str = Field(..., description="UUID of the card owner.")
    query: Optional[str] = Field(default=None, description="Natural language search query string.")
    query_vector: Optional[List[float]] = Field(default=None, description="Pre-computed 384d vector embedding.")
    limit: int = Field(default=20, ge=1, le=100, description="Max number of results to return.")
    threshold: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum cosine similarity threshold.")

class VectorSearchResponse(BaseModel):
    user_id: str
    total: int
    results: List[Dict[str, Any]]

@router.post(
    "/vector",
    summary="Semantic Vector Similarity Search with pgvector",
    response_model=VectorSearchResponse
)
async def vector_search(req: VectorSearchRequest):
    if not req.query and not req.query_vector:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'query' text or 'query_vector' must be supplied."
        )

    try:
        # If text query provided, encode it to vector
        vector = req.query_vector
        if vector is None:
            vector = model_loader.encode(req.query)

        results = vector_store.search_similar_cards(
            user_id=req.user_id,
            query_vector=vector,
            limit=req.limit,
            threshold=req.threshold
        )

        return VectorSearchResponse(
            user_id=req.user_id,
            total=len(results),
            results=results
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vector search failed: {str(e)}"
        )
