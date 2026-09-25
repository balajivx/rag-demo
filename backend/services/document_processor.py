import io
import time
import mimetypes
import logging
from pypdf import PdfReader
from PIL import Image

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500   # words per chunk
OVERLAP = 50       # words overlap between chunks

AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".wma", ".opus"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".svg", ".heic", ".heif", ".ico"}
DOCUMENT_EXTENSIONS = {".pdf", ".txt", ".md", ".csv", ".tsv", ".json", ".log"}

def get_file_info(filename: str, content_type: str = "") -> dict:
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    mime = (content_type or "").lower()

    if ext == ".pdf" or "pdf" in mime:
        return {"category": "pdf", "mime": "application/pdf"}
    elif ext in IMAGE_EXTENSIONS or mime.startswith("image/"):
        guessed_mime = mimetypes.guess_type(filename)[0] or "image/png"
        return {"category": "image", "mime": mime if mime.startswith("image/") else guessed_mime}
    elif ext in AUDIO_EXTENSIONS or mime.startswith("audio/"):
        guessed_mime = mimetypes.guess_type(filename)[0] or "audio/mp3"
        return {"category": "audio", "mime": mime if mime.startswith("audio/") else guessed_mime}
    elif ext in VIDEO_EXTENSIONS or mime.startswith("video/"):
        guessed_mime = mimetypes.guess_type(filename)[0] or "video/mp4"
        return {"category": "video", "mime": mime if mime.startswith("video/") else guessed_mime}
    elif ext in {".csv", ".tsv"}:
        return {"category": "table", "mime": "text/csv"}
    elif ext in {".md", ".markdown"}:
        return {"category": "markdown", "mime": "text/markdown"}
    else:
        return {"category": "text", "mime": "text/plain"}

PRIMARY_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.7-flash",
]

def _generate_multimodal_content(parts: list, prompt: str, max_retries: int = 3) -> str:
    from services.embeddings import _get_client
    client = _get_client()
    contents = parts + [prompt]
    last_error = None

    for attempt in range(max_retries):
        for model_name in PRIMARY_MODELS:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                last_error = e
                logger.warning(f"[Attempt {attempt+1}] Model {model_name} failed: {e}. Trying fallback...")
        if attempt < max_retries - 1:
            time.sleep(1.2)

    if last_error:
        logger.error(f"All multimodal models and retries failed: {last_error}")
    return ""

def _process_pdf(content: bytes, filename: str) -> str:
    text = ""
    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception as e:
                logger.warning(f"Could not decrypt PDF with default password: {e}")

        extracted_pages = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if not page_text.strip():
                try:
                    page_text = page.extract_text(extraction_mode="layout") or ""
                except Exception:
                    pass
            if page_text.strip():
                extracted_pages.append(page_text)

        text = "\n\n".join(extracted_pages)
    except Exception as e:
        logger.warning(f"pypdf extraction failed for {filename}: {e}")

    # Fallback to Gemini multimodal OCR if pypdf could not extract text (e.g. scanned/image PDF)
    if not text.strip():
        try:
            from google.genai import types
            prompt = "Extract and transcribe all text, tables, and data from this document accurately. Output only the extracted text."
            part = types.Part.from_bytes(data=content, mime_type="application/pdf")
            text = _generate_multimodal_content([part], prompt)
        except Exception as e:
            logger.error(f"Gemini PDF OCR fallback failed for {filename}: {e}")

    return text

def _normalize_image(content: bytes) -> tuple[bytes, str]:
    try:
        pil_img = Image.open(io.BytesIO(content))
        if pil_img.mode in ("RGBA", "P", "LA"):
            pil_img = pil_img.convert("RGB")
        elif pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")

        # Resize if overly large for fast processing & token optimization
        pil_img.thumbnail((1800, 1800))
        out_buf = io.BytesIO()
        pil_img.save(out_buf, format="JPEG", quality=88, optimize=True)
        return out_buf.getvalue(), "image/jpeg"
    except Exception as e:
        logger.warning(f"Image normalization failed, using raw bytes: {e}")
        return content, "image/png"

def _process_image(content: bytes, filename: str, mime_type: str) -> str:
    try:
        from google.genai import types

        prompt = (
            f"You are analyzing an image file named '{filename}'. "
            "Please provide a comprehensive, precise description and transcription of all visible contents. "
            "Transcribe verbatim all text, numbers, diagram labels, charts, tables, code, or user interface elements. "
            "Describe key visual features, subjects, and context in detail to enable rich semantic search."
        )

        clean_bytes, normalized_mime = _normalize_image(content)
        part = types.Part.from_bytes(data=clean_bytes, mime_type=normalized_mime)
        return _generate_multimodal_content([part], prompt)
    except Exception as e:
        logger.error(f"Gemini image processing failed for {filename}: {e}")

    return ""

def _process_audio_or_video(content: bytes, filename: str, mime_type: str, category: str) -> str:
    try:
        from google.genai import types

        prompt = (
            f"You are processing a {category} file named '{filename}'. "
            "Please provide a complete, detailed, and accurate transcription of all spoken dialogue, "
            "including timestamp markers (e.g., [00:15], [01:30]) where appropriate, "
            "followed by a structured summary of key discussions, topics, and takeaways. "
            "Output the transcription and summary clearly."
        )

        part = types.Part.from_bytes(data=content, mime_type=mime_type)
        return _generate_multimodal_content([part], prompt)
    except Exception as e:
        logger.error(f"Gemini {category} processing failed for {filename}: {e}")

    return ""



def _chunk_text(text: str) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i : i + CHUNK_SIZE]))
        i += CHUNK_SIZE - OVERLAP
    return chunks

def process_document(content: bytes, filename: str, content_type: str = "") -> list[dict]:
    info = get_file_info(filename, content_type)
    category = info["category"]
    mime = info["mime"]

    text = ""
    if category == "pdf":
        text = _process_pdf(content, filename)
    elif category in {"audio", "video"}:
        text = _process_audio_or_video(content, filename, mime, category)
    elif category == "image":
        text = _process_image(content, filename, mime)
    else:
        text = content.decode("utf-8", errors="replace")

    if not text.strip():
        return []

    chunks = _chunk_text(text)
    return [
        {
            "text": chunk,
            "index": i,
            "file_type": category,
            "filename": filename,
        }
        for i, chunk in enumerate(chunks)
        if chunk.strip()
    ]



