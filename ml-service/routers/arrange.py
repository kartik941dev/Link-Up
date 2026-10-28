import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from services.clusterer import smart_clusterer

logger = logging.getLogger("ml_service.arrange_router")

router = APIRouter(prefix="/arrange", tags=["Smart Arrange & Clustering"])

class SmartArrangeRequest(BaseModel):
    user_id: str = Field(..., description="UUID of the authenticated user")
    min_similarity: Optional[float] = Field(
        default=0.35,
        ge=0.1,
        le=0.95,
        description="Minimum cosine similarity threshold to bridge items into a cluster"
    )

@router.post("/smart-arrange", summary="Perform automated semantic clustering and AI thematic naming")
async def smart_arrange_endpoint(req: SmartArrangeRequest):
    """
    Groups the user's knowledge cards into coherent thematic clusters using Louvain / Agglomerative clustering,
    names each cluster using Groq LLM (Llama 3.1), and returns structured swimlane data.
    """
    try:
        result = smart_clusterer.cluster_user_cards(
            user_id=req.user_id,
            min_cluster_similarity=req.min_similarity or 0.55
        )
        return result
    except Exception as e:
        logger.error(f"Smart arrange endpoint failed for user {req.user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Semantic clustering failed: {str(e)}"
        )
