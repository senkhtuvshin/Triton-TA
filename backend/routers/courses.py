"""
Course registry router — all courses are treated identically; none are protected.

GET    /api/courses               — list all registered courses
POST   /api/courses               — register a new course
DELETE /api/courses/{course_id}   — remove a course and its data files
"""
from __future__ import annotations
import os
import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_BASE         = os.path.dirname(os.path.dirname(__file__))   # backend/
_COURSES_FILE = os.path.join(_BASE, "data", "courses.json")


# ── Registry helpers ──────────────────────────────────────────────────────────

def _load_registry() -> list[dict]:
    if not os.path.isfile(_COURSES_FILE):
        return []
    with open(_COURSES_FILE) as f:
        return json.load(f).get("courses", [])


def _save_registry(courses: list[dict]) -> None:
    with open(_COURSES_FILE, "w") as f:
        json.dump({"courses": courses}, f, indent=2)


def _try_delete(path: str) -> bool:
    if os.path.isfile(path):
        os.remove(path)
        return True
    return False


# ── Pydantic schema ───────────────────────────────────────────────────────────

class CourseIn(BaseModel):
    id:   str
    code: str
    name: str = ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/courses")
async def list_courses():
    """Return all registered courses."""
    return {"courses": _load_registry()}


@router.post("/courses", status_code=201)
async def add_course(body: CourseIn):
    """Register a new course. No-ops silently if the id already exists."""
    courses = _load_registry()
    if not any(c["id"] == body.id for c in courses):
        courses.append({"id": body.id, "code": body.code, "name": body.name})
        _save_registry(courses)
        print(f"[Triton] Course registered: {body.id} ({body.code})")
    return {"id": body.id, "code": body.code, "name": body.name}


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    """
    Remove a course from the registry and delete its associated data files.
    Every course is deleteable — there are no protected built-ins.
    """
    # Remove from registry JSON
    courses = _load_registry()
    updated = [c for c in courses if c["id"] != course_id]
    _save_registry(updated)

    # Delete associated data files
    deleted_files: list[str] = []
    for rel, fname in [
        ("data/calendar", f"{course_id}_events.json"),
        ("data/syllabi",  f"{course_id}_syllabus.json"),
    ]:
        path = os.path.join(_BASE, rel, fname)
        if _try_delete(path):
            deleted_files.append(f"{rel}/{fname}")

    print(
        f"[Triton] Course '{course_id}' deleted. "
        f"Registry entries remaining: {len(updated)}. "
        f"Files removed: {deleted_files or 'none'}"
    )

    return {"deleted": course_id, "files_removed": deleted_files}
