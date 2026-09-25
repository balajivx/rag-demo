import logging
from fastapi import APIRouter
from pydantic import BaseModel
from google.genai import types
from services.embeddings import get_embedding
from services.pinecone_client import search_chunks

logger = logging.getLogger(__name__)

router = APIRouter()

CHAT_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-flash-latest"]

class QueryRequest(BaseModel):
    question: str

@router.post("/query")
async def query_documents(req: QueryRequest):
    from services.embeddings import _get_client

    embedding = get_embedding(req.question)
    results = search_chunks(embedding)

    if not results:
        return {
            "answer": "No relevant documents found. Please upload some documents first.",
            "sources": [],
        }

    context = "\n\n---\n\n".join(
        f"[{r.get('file_type', 'doc').upper()} - {r['source']}]:\n{r['text']}" for r in results
    )

    client = _get_client()
    answer_text = None
    last_error = None

    for model_name in CHAT_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=(
                    f"Here is the relevant content retrieved from the multimodal knowledge base:\n\n"
                    f"{context}\n\n"
                    f"Question: {req.question}\n\n"
                    f"Please answer based on the knowledge base content above."
                ),
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "You are NexusRAG, an advanced multimodal intelligence assistant that answers questions about uploaded documents, images, audio, and video recordings. "
                        "Use the provided context to answer as thoroughly, accurately, and helpfully as possible. "
                        "When citing visual elements, audio timestamps, or specific document sections, reference them clearly."
                    ),
                    max_output_tokens=1500,
                ),
            )
            if response and response.text:
                answer_text = response.text
                break
        except Exception as e:
            last_error = e
            logger.warning(f"Query model {model_name} failed: {e}. Trying fallback...")

    if not answer_text:
        answer_text = f"An error occurred while generating the answer: {last_error}"

    return {
        "answer": answer_text,
        "sources": results,
    }

