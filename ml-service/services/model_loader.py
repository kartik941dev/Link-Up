from __future__ import annotations
import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import gc
import logging
from typing import List, Union
import numpy as np
import torch

torch.set_num_threads(1)
torch.set_num_interop_threads(1)

from config import settings

logger = logging.getLogger("ml_service.model_loader")

class ModelLoader:
    _instance = None
    _model = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        # Lazy initialization: do not load heavy weights during startup
        pass

    def load_model(self):
        if ModelLoader._model is not None:
            return
        logger.info(f"Loading SentenceTransformer model '{settings.model_name}' on device '{settings.model_device}' (single-thread mode)...")
        try:
            from sentence_transformers import SentenceTransformer
            try:
                ModelLoader._model = SentenceTransformer(
                    settings.model_name,
                    device=settings.model_device,
                    local_files_only=True
                )
            except Exception:
                ModelLoader._model = SentenceTransformer(
                    settings.model_name,
                    device=settings.model_device
                )
            gc.collect()
            logger.info(f"Model successfully loaded and initialized! Vector dimension: {settings.embedding_dimension}")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise e

    @property
    def model(self) -> SentenceTransformer:
        if ModelLoader._model is None:
            self.load_model()
        return ModelLoader._model

    def _chunk_text(self, text: str, max_words: int = 180, overlap: int = 30) -> List[str]:
        """
        Splits long text into overlapping word chunks so models with ~256 token limits
        (e.g., all-MiniLM-L6-v2) encode the full document instead of truncating after ~200 words.
        """
        words = text.split()
        if len(words) <= max_words:
            return [text]

        chunks: List[str] = []
        step = max(1, max_words - overlap)
        for start in range(0, len(words), step):
            chunk = " ".join(words[start:start + max_words])
            if chunk:
                chunks.append(chunk)
            if start + max_words >= len(words):
                break
            # Cap at 24 chunks (~3,600 words) for fast CPU latency while covering full docs
            if len(chunks) >= 24:
                break
        return chunks

    def encode(self, texts: Union[str, List[str]]) -> Union[List[float], List[List[float]]]:
        """
        Generates 384-dimensional L2-normalized vector embeddings.
        For long documents (>180 words), splits into overlapping chunks and mean-pools + L2-normalizes.
        Returns List[float] for a single string or List[List[float]] for a list.
        """
        is_single = isinstance(texts, str)
        input_data = [texts] if is_single else texts

        # Filter and clean empty strings
        cleaned_inputs = [t.strip() if t and t.strip() else "empty document" for t in input_data]

        # Build flattened chunk list and track slice boundaries per input document
        all_chunks: List[str] = []
        doc_slices: List[tuple[int, int]] = []
        for doc_text in cleaned_inputs:
            chunks = self._chunk_text(doc_text)
            start_idx = len(all_chunks)
            all_chunks.extend(chunks)
            doc_slices.append((start_idx, len(all_chunks)))

        chunk_embeddings = self.model.encode(
            all_chunks,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True
        )

        # Pool chunk vectors per document (mean pooling + L2 re-normalization)
        embeddings_list: List[List[float]] = []
        for start_idx, end_idx in doc_slices:
            if end_idx - start_idx == 1:
                vec = chunk_embeddings[start_idx]
            else:
                vec = np.mean(chunk_embeddings[start_idx:end_idx], axis=0)
                norm = np.linalg.norm(vec)
                if norm > 1e-12:
                    vec = vec / norm
            embeddings_list.append(vec.astype(float).tolist())

        return embeddings_list[0] if is_single else embeddings_list

model_loader = ModelLoader.get_instance()
