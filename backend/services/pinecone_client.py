import os
from pinecone import Pinecone
from services.embeddings import get_embedding

import hashlib
import unicodedata
import re

def _sanitize_vector_id(filename: str, chunk_index: int) -> str:
    # Normalize unicode to ASCII
    normalized = unicodedata.normalize('NFKD', filename)
    ascii_clean = normalized.encode('ascii', 'ignore').decode('ascii')
    safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', ascii_clean).strip('_')
    if not safe_name:
        safe_name = "doc"
    if len(safe_name) > 80:
        safe_name = safe_name[:80]
    raw_hash = hashlib.md5(filename.encode("utf-8", errors="ignore")).hexdigest()[:8]
    return f"{safe_name}_{raw_hash}__{chunk_index}"

def _index():
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    return pc.Index(os.getenv("PINECONE_INDEX_NAME", "rag-demo"))

def upsert_chunks(chunks: list[dict], filename: str):
    index = _index()
    vectors = []
    for chunk in chunks:
        embedding = get_embedding(chunk["text"])
        vector_id = _sanitize_vector_id(filename, chunk["index"])
        vectors.append({
            "id": vector_id,
            "values": embedding,
            "metadata": {
                "text": chunk["text"],
                "source": filename,
                "file_type": chunk.get("file_type", "document"),
            },
        })
    # Pinecone recommends batches of 100
    for i in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[i : i + 100])

def search_chunks(embedding: list[float], top_k: int = 10) -> list[dict]:
    results = _index().query(vector=embedding, top_k=top_k, include_metadata=True)
    return [
        {
            "text": m.metadata.get("text", ""),
            "source": m.metadata.get("source", ""),
            "file_type": m.metadata.get("file_type", "document"),
            "score": round(m.score, 4),
        }
        for m in results.matches
    ]

