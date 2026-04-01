"""
POST /api/upload-pdf  — Upload, index, and optionally auto-extract syllabus metadata.
GET  /api/documents   — List indexed documents per course.
"""
from __future__ import annotations
import os
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from models.schemas import UploadResponseExtended
from services.pdf_service import parse_and_chunk_pdf
from services.rag_service import add_chunks, list_documents
from services.llm_service import extract_syllabus_metadata

router = APIRouter()

_REGISTRY_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "documents_registry.json"
)
_SYLLABI_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "syllabi"
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _user_id(request: Request) -> str:
    return request.headers.get("X-User-ID", "local")


def _load_registry() -> list[dict]:
    if not os.path.isfile(_REGISTRY_PATH):
        return []
    with open(_REGISTRY_PATH) as f:
        return json.load(f)


def _save_registry(registry: list[dict]):
    with open(_REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)


def _syllabus_path(course_id: str) -> str:
    return os.path.join(_SYLLABI_DIR, f"{course_id}_syllabus.json")


def _ensure_syllabus(course_id: str) -> None:
    """Create a blank syllabus JSON for new/custom courses if none exists."""
    path = _syllabus_path(course_id)
    if not os.path.isfile(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump({"course_id": course_id, "events": []}, f, indent=2)


def _merge_extracted_events(course_id: str, new_events: list[dict]) -> int:
    _ensure_syllabus(course_id)
    path = _syllabus_path(course_id)
    if not os.path.isfile(path):
        return 0
    with open(path) as f:
        syllabus = json.load(f)
    existing      = syllabus.get("events", [])
    existing_keys = {(e.get("title", "").lower(), e.get("date", "")) for e in existing}
    added = 0
    for ev in new_events:
        if ev.get("date") == "TBD":
            continue
        key = (ev["title"].lower(), ev["date"])
        if key in existing_keys:
            continue
        existing.append({
            "id":               f"auto_{uuid.uuid4().hex[:6]}",
            "type":             ev["type"],
            "title":            ev["title"],
            "date":             ev["date"],
            "topics_covered":   ev.get("topics_covered", []),
            "practice_problems": [],
        })
        existing_keys.add(key)
        added += 1
    syllabus["events"] = sorted(existing, key=lambda e: e.get("date", "9999"))
    with open(path, "w") as f:
        json.dump(syllabus, f, indent=2)
    return added


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/upload-pdf", response_model=UploadResponseExtended)
async def upload_pdf(
    request: Request,
    file: UploadFile = File(...),
    course_id: str = Form(...),
    document_type: str = Form(...),
):
    user_id = _user_id(request)

    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    tmp_path = f"/tmp/{uuid.uuid4()}_{file.filename}"
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 20MB.")

    with open(tmp_path, "wb") as f:
        f.write(contents)

    summary_spark:    list[str]  = []
    extracted_events: list[dict] = []

    try:
        chunks    = parse_and_chunk_pdf(tmp_path, course_id)
        n_indexed = add_chunks(course_id, chunks)

        if document_type == "syllabus" and chunks:
            full_text = " ".join(c["text"] for c in chunks[:20])
            try:
                meta             = extract_syllabus_metadata(full_text, course_id)
                summary_spark    = meta.get("summary_spark", [])
                extracted_events = meta.get("events", [])
                _merge_extracted_events(course_id, extracted_events)
            except Exception as e:
                summary_spark = [f"Syllabus indexed ({n_indexed} chunks). Metadata extraction failed: {e}"]

    finally:
        os.remove(tmp_path)

    document_id = f"doc_{uuid.uuid4().hex[:8]}_{course_id}"
    doc_record  = {
        "document_id":    document_id,
        "file_name":      file.filename,
        "course_id":      course_id,
        "document_type":  document_type,
        "chunks_indexed": n_indexed,
        "uploaded_at":    datetime.now(timezone.utc).isoformat(),
    }

    # Persist: Supabase if available, else local JSON
    from services.supabase_service import add_document, is_configured
    if is_configured() and user_id != "local":
        add_document(user_id, doc_record)
    else:
        registry = _load_registry()
        registry.append(doc_record)
        _save_registry(registry)

    return UploadResponseExtended(
        status           = "success",
        chunks_indexed   = n_indexed,
        document_id      = document_id,
        message          = f"Indexed {n_indexed} chunks from {file.filename} into {course_id} collection",
        summary_spark    = summary_spark,
        extracted_events = extracted_events,
    )


@router.get("/documents")
async def get_documents(
    request: Request,
    course_id: str | None = None,
):
    user_id = _user_id(request)

    from services.supabase_service import get_documents as sb_get_docs, is_configured
    if is_configured() and user_id != "local":
        docs = sb_get_docs(user_id, course_id)
        if docs is not None:
            return {"documents": docs, "total": len(docs)}

    registry = _load_registry()
    if course_id:
        registry = [d for d in registry if d["course_id"] == course_id]
    return {"documents": registry, "total": len(registry)}
