from typing import List, Optional, Union
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from services.model_loader import model_loader
from services.keyword_extractor import extract_keywords
from config import settings

router = APIRouter(prefix="", tags=["Embeddings"])

class EmbedRequest(BaseModel):
    text: Optional[str] = Field(default=None, description="Single text string to generate embedding for.")
    texts: Optional[List[str]] = Field(default=None, description="Batch list of texts to generate embeddings for.")

class SingleEmbedResponse(BaseModel):
    embedding: List[float]
    dimension: int

class BatchEmbedResponse(BaseModel):
    embeddings: List[List[float]]
    dimension: int

class KeywordRequest(BaseModel):
    title: str = Field(default="", description="Document title")
    text: str = Field(default="", description="Extracted document text")
    top_k: int = Field(default=4, ge=2, le=6, description="Number of content keywords to extract")

class KeywordResponse(BaseModel):
    keywords: List[str]

@router.post(
    "/embed",
    summary="Generate 384d Dense Vector Embeddings",
    response_model=Union[SingleEmbedResponse, BatchEmbedResponse]
)
async def generate_embeddings(req: EmbedRequest):
    if not req.text and not req.texts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'text' or 'texts' field must be provided."
        )

    try:
        if req.text is not None:
            embedding = model_loader.encode(req.text)
            return SingleEmbedResponse(
                embedding=embedding,
                dimension=settings.embedding_dimension
            )
        else:
            embeddings = model_loader.encode(req.texts)
            return BatchEmbedResponse(
                embeddings=embeddings,
                dimension=settings.embedding_dimension
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embeddings: {str(e)}"
        )


@router.post(
    "/keywords",
    summary="Extract 2-4 lowercase semantic content keywords for a card",
    response_model=KeywordResponse
)
async def generate_keywords(req: KeywordRequest):
    try:
        keywords = extract_keywords(req.title, req.text, top_k=req.top_k)
        return KeywordResponse(keywords=keywords)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract keywords: {str(e)}"
        )
