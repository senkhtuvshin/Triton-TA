"""
Singleton wrapper for the sentence-transformers embedding model.
Loaded once at startup to avoid reloading on every request.
Model: all-MiniLM-L6-v2 — 80MB, CPU-fast, 384-dim vectors.
"""
from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    model = get_model()
    embeddings = model.encode(texts, show_progress_bar=False)
    # `.encode()` returns a numpy array in newer sentence-transformers versions
    return [e.tolist() if hasattr(e, "tolist") else list(e) for e in embeddings]
