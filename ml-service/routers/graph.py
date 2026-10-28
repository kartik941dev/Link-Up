import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from services.graph_builder import graph_builder

logger = logging.getLogger("ml_service.routers.graph")

router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])

class GraphBuildRequest(BaseModel):
    user_id: str = Field(..., description="UUID of the user")
    min_similarity: Optional[float] = Field(default=0.60, ge=0.1, le=1.0, description="Minimum cosine similarity threshold")

class GraphBuildResponse(BaseModel):
    status: str
    user_id: str
    node_count: int
    edge_count: int
    edges: List[Dict[str, Any]]
    centralities: Dict[str, float]

@router.post("/build", response_model=GraphBuildResponse, summary="Build Knowledge Graph for User")
async def build_knowledge_graph(payload: GraphBuildRequest):
    """
    Computes pairwise vector similarity for all user cards, extracts edges above
    the threshold, computes PageRank centrality, and saves results to graph_edges.
    """
    try:
        result = graph_builder.build_user_graph(
            user_id=payload.user_id,
            min_similarity=payload.min_similarity or 0.60
        )
        return result
    except Exception as e:
        logger.error(f"Failed to build graph for user {payload.user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
