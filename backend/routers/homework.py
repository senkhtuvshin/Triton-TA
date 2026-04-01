"""
GET    /api/homework-errors/{course_id}                        — List errors
POST   /api/homework-errors/{course_id}                        — Log new error
PATCH  /api/homework-errors/{course_id}                        — Mark resolved (legacy)
PATCH  /api/homework-errors/{course_id}/{error_id}/status      — Update 3-state status
POST   /api/homework-errors/{course_id}/{error_id}/deep-dive   — Generate recovery plan
GET    /api/homework-errors/{course_id}/briefing               — Daily Triton briefing
"""
from __future__ import annotations
import os
import json
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from models.schemas import (
    HomeworkError, HomeworkErrorsResponse, ResolveErrorRequest,
    UpdateStatusRequest, DeepDiveResponse, BriefingResponse,
)
from services.rag_service import retrieve_context
from services.llm_service import generate_deep_dive, generate_briefing
from services.countdown_service import get_next_exam
from models.prompts import get_course_name as _get_course_name

router = APIRouter()



# ── Helpers ────────────────────────────────────────────────────────────────────

def _user_id(request: Request) -> str:
    return request.headers.get("X-User-ID", "local")


def _errors_path(course_id: str) -> str:
    return os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "data", "homework_errors", f"{course_id}_errors.json"
    )


def _load_errors(course_id: str) -> dict:
    path = _errors_path(course_id)
    if not os.path.isfile(path):
        return {"course_id": course_id, "errors": []}
    with open(path) as f:
        return json.load(f)


def _save_errors(course_id: str, data: dict):
    with open(_errors_path(course_id), "w") as f:
        json.dump(data, f, indent=2, default=str)


def _hydrate(raw: dict) -> dict:
    if "status" not in raw:
        raw["status"] = "mastered" if raw.get("resolved", False) else "unresolved"
    raw["resolved"] = raw["status"] == "mastered"
    return raw


def _load_errors_for_user(user_id: str, course_id: str) -> list[dict]:
    """Load errors from Supabase if configured, else local JSON."""
    from services.supabase_service import get_errors, is_configured
    if is_configured() and user_id != "local":
        rows = get_errors(user_id, course_id)
        if rows is not None:
            return [_hydrate(r) for r in rows]
    data = _load_errors(course_id)
    return [_hydrate(e) for e in data.get("errors", [])]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/homework-errors/{course_id}/briefing", response_model=BriefingResponse)
async def get_briefing(course_id: str, request: Request):
    user_id = _user_id(request)
    errors = _load_errors_for_user(user_id, course_id)
    now    = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)

    stale = []
    for e in errors:
        if e.get("status", "unresolved") == "unresolved":
            recorded = e.get("recorded_at")
            if recorded:
                try:
                    rec_dt = datetime.fromisoformat(str(recorded).replace("Z", "+00:00"))
                    if rec_dt < cutoff:
                        stale.append(e)
                except ValueError:
                    stale.append(e)

    stale_topics = list({e["topic"].replace("_", " ") for e in stale})

    next_exam  = get_next_exam(course_id)
    exam_title = next_exam["exam_title"]     if next_exam else None
    days_until = next_exam["days_remaining"] if next_exam else None

    # ── New-course short-circuit ──────────────────────────────────────────
    # If the student has never logged a single error for this course, the AI
    # has nothing meaningful to say ("Welcome back, let's get started!").
    # Instead, return a static getting-started message and skip the LLM call.
    is_new_course = len(errors) == 0

    if is_new_course:
        course_display = _get_course_name(course_id)
        greeting = (
            f"Welcome to {course_display}! Upload your syllabus to populate the calendar, "
            f"then head to Chat with TA whenever you hit your first tricky problem."
        )
    else:
        greeting = generate_briefing(
            course_name     = _get_course_name(course_id),
            stale_topics    = stale_topics,
            next_exam_title = exam_title,
            days_until_exam = days_until,
        )

    return BriefingResponse(
        course_id        = course_id,
        has_stale_errors = len(stale) > 0,
        stale_count      = len(stale),
        stale_topics     = stale_topics,
        greeting         = greeting,
        next_exam_title  = exam_title,
        days_until_exam  = days_until,
        is_new_course    = is_new_course,
    )


@router.get("/homework-errors/{course_id}", response_model=HomeworkErrorsResponse)
async def get_errors(course_id: str, request: Request):
    user_id = _user_id(request)
    errors  = _load_errors_for_user(user_id, course_id)
    models  = [HomeworkError(**e) for e in errors]
    unresolved = sum(1 for e in models if e.status == "unresolved")
    return HomeworkErrorsResponse(course_id=course_id, errors=models, total_unresolved=unresolved)


@router.post("/homework-errors/{course_id}", response_model=HomeworkError)
async def log_error(course_id: str, error: HomeworkError, request: Request):
    user_id = _user_id(request)
    error.id          = error.id or f"err_{uuid.uuid4().hex[:8]}"
    error.recorded_at = error.recorded_at or datetime.now(timezone.utc)
    error.status      = "unresolved"
    error.resolved    = False

    from services.supabase_service import add_error, is_configured
    if is_configured() and user_id != "local":
        row = add_error(user_id, course_id, error.model_dump())
        if row:
            return HomeworkError(**_hydrate(row))

    # JSON fallback
    data = _load_errors(course_id)
    data["errors"].append(error.model_dump())
    _save_errors(course_id, data)
    return error


@router.patch("/homework-errors/{course_id}", response_model=HomeworkError)
async def resolve_error_legacy(
    course_id: str,
    payload: ResolveErrorRequest,
    request: Request,
):
    user_id = _user_id(request)
    updates = {"resolved": payload.resolved, "status": "mastered" if payload.resolved else "unresolved"}

    from services.supabase_service import update_error, is_configured
    if is_configured() and user_id != "local":
        row = update_error(user_id, payload.error_id, updates)
        if row:
            return HomeworkError(**_hydrate(row))

    data = _load_errors(course_id)
    for err in data["errors"]:
        if err["id"] == payload.error_id:
            err.update(updates)
            _save_errors(course_id, data)
            return HomeworkError(**_hydrate(err))
    raise HTTPException(status_code=404, detail=f"Error {payload.error_id} not found")


@router.patch("/homework-errors/{course_id}/{error_id}/status", response_model=HomeworkError)
async def update_status(
    course_id: str,
    error_id: str,
    payload: UpdateStatusRequest,
    request: Request,
):
    user_id = _user_id(request)
    updates = {"status": payload.status, "resolved": payload.status == "mastered"}

    from services.supabase_service import update_error, is_configured
    if is_configured() and user_id != "local":
        row = update_error(user_id, error_id, updates)
        if row:
            return HomeworkError(**_hydrate(row))

    data = _load_errors(course_id)
    for err in data["errors"]:
        if err["id"] == error_id:
            err.update(updates)
            _save_errors(course_id, data)
            return HomeworkError(**_hydrate(err))
    raise HTTPException(status_code=404, detail=f"Error {error_id} not found")


@router.post("/homework-errors/{course_id}/{error_id}/deep-dive", response_model=DeepDiveResponse)
async def deep_dive(course_id: str, error_id: str, request: Request):
    user_id = _user_id(request)
    errors  = _load_errors_for_user(user_id, course_id)
    target  = next((e for e in errors if e.get("id") == error_id), None)
    if not target:
        raise HTTPException(status_code=404, detail=f"Error {error_id} not found")

    query = f"{target.get('topic','')} {target.get('subtopic','')} {target.get('description','')}".strip()
    rag_chunks  = retrieve_context(course_id, query, top_k=4)
    rag_context = "\n\n---\n\n".join(
        f"[Source: {c['source']}]\n{c['text']}" for c in rag_chunks
    ) if rag_chunks else ""

    try:
        plan = generate_deep_dive(
            topic       = target.get("topic", ""),
            subtopic    = target.get("subtopic", ""),
            description = target.get("description", ""),
            rag_context = rag_context,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {exc}. Is Ollama running?")

    return DeepDiveResponse(
        error_id           = error_id,
        refresher          = plan.get("refresher", ""),
        simplified_problem = plan.get("simplified_problem", ""),
        pdf_pointer        = plan.get("pdf_pointer", ""),
        generated_at       = datetime.now(timezone.utc),
    )
