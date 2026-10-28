import logging
from typing import List, Union
import numpy as np
from sentence_transformers import SentenceTransformer
from config import settings

logger = logging.getLogger("ml_service.model_loader")

class ModelLoader:
    _instance = None
    _model: SentenceTransformer = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        if ModelLoader._model is None:
            self.load_model()

    def load_model(self):
        logger.info(f"Loading SentenceTransformer model '{settings.model_name}' on device '{settings.model_device}'...")
        try:
            ModelLoader._model = SentenceTransformer(settings.model_name, device=settings.model_device)
            # Warm up with dummy inference
            dummy_embedding = ModelLoader._model.encode("LinkUp knowledge management warm up", normalize_embeddings=True)
            logger.info(f"Model successfully loaded and initialized! Vector dimension: {len(dummy_embedding)}")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise e

    @property
    def model(self) -> SentenceTransformer:
        if ModelLoader._model is None:
            self.load_model()
        return ModelLoader._model

    def encode(self, texts: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        """
        Generates 384-dimensional normalized vector embeddings.
        Returns List[float] for a single string or List[List[float]] for a list.
        """
        is_single = isinstance(texts, str)
        input_data = [texts] if is_single else texts

        # Filter and clean empty strings
        cleaned_inputs = [t.strip() if t and t.strip() else "empty document" for t in input_data]

        embeddings = self.model.encode(
            cleaned_inputs,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True
        )

        # Convert to standard Python lists
        embeddings_list = [emb.tolist() for emb in embeddings]
        return embeddings_list[0] if is_single else embeddings_list

model_loader = ModelLoader.get_instance()
