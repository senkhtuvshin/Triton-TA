"""
RAG service: ChromaDB ingestion and semantic retrieval.
One collection per course, cosine similarity, persistent across restarts.
"""
from __future__ import annotations
import os
import chromadb
from services.embedding_service import embed_texts

_client: chromadb.PersistentClient | None = None


def _get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        db_path = os.getenv("CHROMA_DB_PATH", "./data/chroma_db")
        _client = chromadb.PersistentClient(path=db_path)
    return _client


def _get_collection(course_id: str):
    client = _get_client()
    return client.get_or_create_collection(
        name=f"course_{course_id}",
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(course_id: str, chunks: list[dict]) -> int:
    if not chunks:
        return 0

    collection = _get_collection(course_id)
    texts = [c["text"] for c in chunks]
    embeddings = embed_texts(texts)

    ids = [
        f"{course_id}_{c['metadata']['source_file']}_{c['metadata']['chunk_index']}"
        for c in chunks
    ]

    # Upsert avoids duplicate errors on re-ingestion
    collection.upsert(
        documents=texts,
        embeddings=embeddings,
        metadatas=[c["metadata"] for c in chunks],
        ids=ids,
    )
    return len(chunks)


def retrieve_context(course_id: str, query: str, top_k: int = 4) -> list[dict]:
    collection = _get_collection(course_id)
    count = collection.count()
    if count == 0:
        return []

    query_embedding = embed_texts([query])[0]
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, count),
        include=["documents", "metadatas", "distances"],
    )

    filtered = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        # cosine distance < 0.6 means reasonably relevant
        if dist < 0.6:
            filtered.append({
                "text": doc,
                "source": meta.get("source_file", "unknown"),
                "score": round(1 - dist, 3),
            })

    return filtered


def list_documents(course_id: str) -> list[str]:
    """Return unique source file names indexed for a course."""
    collection = _get_collection(course_id)
    if collection.count() == 0:
        return []
    results = collection.get(include=["metadatas"])
    files = {m.get("source_file", "") for m in results["metadatas"]}
    return sorted(f for f in files if f)
