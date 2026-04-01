"""
Calendar / Universal Ingestor router.

GET    /api/calendar/events/{course_id}         — List all events (syllabus + stored)
POST   /api/calendar/ingest                     — Extract events from raw text or Google Doc
POST   /api/calendar/events/{course_id}         — Add a single manual event
PATCH  /api/calendar/events/{event_id}/complete — Toggle completed flag
DELETE /api/calendar/events/{event_id}          — Remove an event
"""
from __future__ import annotations
import os
import json
import uuid
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from services.llm_service import extract_calendar_events, fuzzy_exam_scan
from services.countdown_service import load_syllabus

router = APIRouter()

_CAL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "calendar"
)
os.makedirs(_CAL_DIR, exist_ok=True)


# ── Pydantic models ─────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    text:        str
    course_id:   str
    source:      str = "scraped"       # "scraped" | "manual" | "google_doc"
    google_doc_id: str | None = None   # if provided, backend fetches export


class ManualEventRequest(BaseModel):
    title:       str
    type:        str = "ASSIGNMENT"    # EXAM | ASSIGNMENT | QUIZ | LECTURE | OFFICE_HOURS
    due_date:    str = "TBD"
    weight:      int = 0
    description: str = ""


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_id(request: Request) -> str:
    return request.headers.get("X-User-ID", "local")


def _cal_path(course_id: str) -> str:
    return os.path.join(_CAL_DIR, f"{course_id}_events.json")


def _load_local(course_id: str) -> list[dict]:
    path = _cal_path(course_id)
    if not os.path.isfile(path):
        return []
    with open(path) as f:
        return json.load(f).get("events", [])


def _save_local(course_id: str, events: list[dict]) -> None:
    with open(_cal_path(course_id), "w") as f:
        json.dump({"course_id": course_id, "events": events}, f, indent=2)


def _dedup_key(ev: dict) -> tuple:
    """
    Normalise a title for deduplication.
    Strips trailing parentheticals like '(Spring 2026)' so that
    'MyLab HW 1' and 'MyLab HW 1 (Spring 2026)' are treated as the same event.
    """
    import re as _re
    title = ev.get("title", "")
    title = _re.sub(r"\s*\([^)]*\)\s*$", "", title).lower().strip()
    return (title, ev.get("due_date", ""), ev.get("type", ""))


def _dedup(events: list[dict]) -> list[dict]:
    """Return events with duplicates removed. Later entries win over earlier ones."""
    seen: dict = {}
    for ev in events:
        seen[_dedup_key(ev)] = ev          # last writer wins
    return list(seen.values())


def _syllabus_to_cal_events(course_id: str) -> list[dict]:
    """Convert existing syllabus JSON events into CalendarEvent format."""
    syllabus = load_syllabus(course_id)
    out = []
    for ev in syllabus.get("events", []):
        etype = ev.get("type", "lecture").upper()
        type_map = {
            "midterm":      "EXAM",
            "final":        "EXAM",
            "homework_due": "ASSIGNMENT",
            "quiz":         "QUIZ",
            "lecture":      "LECTURE",
        }
        out.append({
            "id":          f"syl_{ev.get('id', uuid.uuid4().hex[:6])}",
            "course_id":   course_id,
            "title":       ev.get("title", ""),
            "type":        type_map.get(ev.get("type", ""), etype),
            "due_date":    ev.get("date", "TBD"),
            "weight":      0,
            "description": f"Topics: {', '.join(ev.get('topics_covered', []))}",
            "completed":   False,
            "source":      "syllabus",
            "created_at":  datetime.now(timezone.utc).isoformat(),
        })
    return out


async def _fetch_google_doc(doc_id: str) -> str:
    """
    Fetch a Google Doc as plain text via the public export URL.
    Only works if the document is publicly accessible / shared with link.
    """
    url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, follow_redirects=True)
    if resp.status_code != 200:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Could not fetch Google Doc (status {resp.status_code}). "
                "Make sure the document is shared with 'Anyone with the link'."
            ),
        )
    return resp.text


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/calendar/events/{course_id}")
async def get_events(course_id: str, request: Request):
    """
    Merge three sources:
      1. Syllabus JSON (static, read-only)
      2. Local stored events (scraped / manual)
      3. Supabase assignments (if configured)
    """
    user_id = _user_id(request)

    # Source 1 — syllabus (legacy seeded JSON)
    events = _syllabus_to_cal_events(course_id)

    # Source 2 — local stored events (scraped / manual)
    events.extend(_load_local(course_id))

    # Source 3 — Supabase
    from services.supabase_service import get_assignments, is_configured
    if is_configured() and user_id != "local":
        sb_events = get_assignments(user_id, course_id)
        if sb_events:
            events.extend(sb_events)

    # Deduplicate across all three sources (normalized title + date + type)
    events = _dedup(events)

    # Sort by due_date (TBD events go last)
    def sort_key(ev):
        d = ev.get("due_date", "TBD")
        return d if d != "TBD" else "9999-99-99"

    events.sort(key=sort_key)
    return {"course_id": course_id, "events": events, "total": len(events)}


@router.post("/calendar/ingest")
async def ingest_text(body: IngestRequest, request: Request):
    """
    Universal Ingestor.  Accepts raw text or a Google Doc ID.
    Runs the event extraction LLM pipeline and saves results.
    """
    user_id = _user_id(request)
    text = body.text

    # Google Doc Bridge — fetch export if doc_id provided
    if body.google_doc_id:
        text = await _fetch_google_doc(body.google_doc_id)

    if not text.strip():
        raise HTTPException(status_code=400, detail="No text to process.")

    raw_events = extract_calendar_events(text, body.course_id)

    # ── Multi-Pass: if LLM returned nothing, run regex fuzzy scan ───────────
    if not raw_events:
        print(
            "[Triton Ingest] LLM returned 0 events — "
            "running fuzzy regex fallback pass"
        )
        raw_events = fuzzy_exam_scan(text, body.course_id)

    now = datetime.now(timezone.utc).isoformat()
    saved: list[dict] = []

    confirmed: list[dict] = []
    drafts:    list[dict] = []

    for ev in raw_events:
        if not ev.get("title"):
            continue
        record = {
            "id":          f"cal_{uuid.uuid4().hex[:8]}",
            "course_id":   body.course_id,
            "title":       ev["title"],
            "type":        ev["type"],
            "due_date":    ev["due_date"],
            "weight":      ev.get("weight", 0),
            "description": ev.get("description", ""),
            "completed":   False,
            # Draft events have source="draft" so the frontend can identify them
            "source":      "draft" if ev.get("is_draft") else body.source,
            "created_at":  now,
        }
        if ev.get("is_draft"):
            drafts.append(record)
        else:
            confirmed.append(record)

    # Persist only confirmed events; deduplicate against what's already stored
    from services.supabase_service import add_assignments, is_configured
    if is_configured() and user_id != "local":
        if confirmed:
            add_assignments(user_id, confirmed)
    else:
        existing  = _load_local(body.course_id)
        merged    = _dedup(existing + confirmed)   # existing wins on title+date collision
        # Only count truly new records
        new_count = len(merged) - len(existing)
        _save_local(body.course_id, merged)
        print(f"[Triton Ingest] Saved {new_count} new event(s) "
              f"({len(confirmed) - new_count} duplicate(s) skipped)")

    return {
        "status":           "success",
        "events_extracted": len(confirmed),
        "events":           confirmed,
        "draft_events":     drafts,      # Fix 3: returned for user review
    }


@router.post("/calendar/events/{course_id}")
async def add_event(course_id: str, body: ManualEventRequest, request: Request):
    """Add a single manually-entered calendar event."""
    user_id = _user_id(request)
    record = {
        "id":          f"cal_{uuid.uuid4().hex[:8]}",
        "course_id":   course_id,
        "title":       body.title,
        "type":        body.type.upper(),
        "due_date":    body.due_date,
        "weight":      body.weight,
        "description": body.description,
        "completed":   False,
        "source":      "manual",
        "created_at":  datetime.now(timezone.utc).isoformat(),
    }

    from services.supabase_service import add_assignments, is_configured
    if is_configured() and user_id != "local":
        add_assignments(user_id, [record])
    else:
        existing = _load_local(course_id)
        existing.append(record)
        _save_local(course_id, existing)

    return record


@router.patch("/calendar/events/{event_id}/complete")
async def toggle_complete(event_id: str, request: Request):
    """Toggle the completed flag on a calendar event."""
    user_id = _user_id(request)
    body = await request.json()
    completed = bool(body.get("completed", True))

    from services.supabase_service import update_assignment, is_configured
    if is_configured() and user_id != "local":
        row = update_assignment(user_id, event_id, {"completed": completed})
        if row:
            return row

    # Local fallback — search all course files
    for fname in os.listdir(_CAL_DIR):
        if not fname.endswith("_events.json"):
            continue
        course_id = fname.replace("_events.json", "")
        events = _load_local(course_id)
        for ev in events:
            if ev["id"] == event_id:
                ev["completed"] = completed
                _save_local(course_id, events)
                return ev

    raise HTTPException(status_code=404, detail=f"Event {event_id} not found")


@router.delete("/calendar/events/{event_id}")
async def delete_event(event_id: str, request: Request):
    """Delete a calendar event (cannot delete syllabus-source events)."""
    user_id = _user_id(request)

    from services.supabase_service import delete_assignment, is_configured
    if is_configured() and user_id != "local":
        ok = delete_assignment(user_id, event_id)
        if ok:
            return {"deleted": event_id}

    for fname in os.listdir(_CAL_DIR):
        if not fname.endswith("_events.json"):
            continue
        course_id = fname.replace("_events.json", "")
        events = _load_local(course_id)
        filtered = [e for e in events if e["id"] != event_id]
        if len(filtered) < len(events):
            _save_local(course_id, filtered)
            return {"deleted": event_id}

    raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
