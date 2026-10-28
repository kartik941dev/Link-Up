import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from services.model_loader import model_loader, ModelLoader
from services.vector_store import vector_store
from routers import embed, search, graph, arrange, rag

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("ml_service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing LinkUp ML Microservice...")
    # Check DB connectivity
    try:
        db_connected = vector_store.is_connected()
        logger.info(f"VectorStore DB connected: {db_connected}")
    except Exception as e:
        logger.warn(f"VectorStore check warning: {e}")

    yield
    logger.info("Shutting down LinkUp ML Microservice.")

app = FastAPI(
    title="LinkUp Machine Learning & Semantic Intelligence Service",
    description="Vector embeddings, pgvector cosine search, graph topology, and AI orchestration microservice.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount sub-routers
app.include_router(embed.router)
app.include_router(search.router)
app.include_router(graph.router)
app.include_router(arrange.router)
app.include_router(rag.router)

@app.get("/health", summary="Health Check & Model Diagnostics")
async def health_check():
    db_status = vector_store.is_connected()
    return {
        "status": "ok",
        "service": "linkup-ml-service",
        "model": {
            "name": settings.model_name,
            "dimension": settings.embedding_dimension,
            "device": settings.model_device,
            "loaded": ModelLoader._model is not None,
        },
        "database": {
            "connected": db_status
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
