import logging
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.document_processor import process_document, get_file_info
from services.pinecone_client import upsert_chunks

logger = logging.getLogger(__name__)

router = APIRouter()

SUPPORTED_EXTENSIONS = {
    ".pdf", ".txt", ".md", ".csv", ".tsv", ".json", ".log",
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".svg",
    ".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".wma",
    ".mp4", ".webm", ".mov", ".mkv", ".avi"
}


@router.post("/upload")
async def upload_documents(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
):
    items: List[UploadFile] = []
    if files:
        items.extend(files)
    if file and file not in items:
        items.append(file)

    if not items:
        raise HTTPException(status_code=400, detail="No files were provided for upload.")

    results = []
    total_indexed_chunks = 0

    for item in items:
        filename = item.filename or "uploaded_file"
        ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
        file_info = get_file_info(filename, item.content_type or "")
        category = file_info["category"]

        try:
            content = await item.read()
            if not content:
                results.append({
                    "filename": filename,
                    "status": "error",
                    "file_type": category,
                    "chunks": 0,
                    "error": "File is empty",
                })
                continue

            chunks = process_document(content, filename, item.content_type or "")

            if not chunks:
                results.append({
                    "filename": filename,
                    "status": "error",
                    "file_type": category,
                    "chunks": 0,
                    "error": "Could not extract or transcribe readable content",
                })
                continue

            upsert_chunks(chunks, filename)
            total_indexed_chunks += len(chunks)

            results.append({
                "filename": filename,
                "status": "success",
                "file_type": category,
                "chunks": len(chunks),
            })
        except Exception as e:
            logger.error(f"Error processing {filename}: {e}", exc_info=True)
            results.append({
                "filename": filename,
                "status": "error",
                "file_type": category,
                "chunks": 0,
                "error": str(e),
            })

    # Return summary
    success_count = sum(1 for r in results if r["status"] == "success")
    if success_count == 0 and len(results) > 0:
        first_err = results[0].get("error", "Failed to process files.")
        raise HTTPException(status_code=400, detail=first_err)

    return {
        "message": f"Successfully indexed {success_count} of {len(results)} file(s)",
        "files": results,
        "total_chunks": total_indexed_chunks,
        # Backward compatibility for single file callers
        "chunks": total_indexed_chunks,
        "filename": results[0]["filename"] if results else "",
    }


