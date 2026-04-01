"""
Supabase storage backend.
Falls back gracefully when SUPABASE_URL / SUPABASE_SERVICE_KEY are not set.
All public functions return None / [] / 0 when Supabase is unconfigured so
callers can fall back to local JSON storage.
"""
from __future__ import annotations
import os
from collections import Counter

_client_cache = None


def _client():
    """Return a Supabase client or None if not configured."""
    global _client_cache
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    if not url or not key:
        return None
    if _client_cache is None:
        try:
            from supabase import create_client
            _client_cache = create_client(url, key)
        except Exception:
            return None
    return _client_cache


def is_configured() -> bool:
    return _client() is not None


# ── Homework Errors ────────────────────────────────────────────────────────────

def get_errors(user_id: str, course_id: str) -> list[dict] | None:
    """Return list of error dicts for this user+course, or None if unavailable."""
    c = _client()
    if not c:
        return None
    try:
        res = c.table("homework_errors") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("course_id", course_id) \
            .order("recorded_at", desc=False) \
            .execute()
        return res.data or []
    except Exception:
        return None


def add_error(user_id: str, course_id: str, error: dict) -> dict | None:
    c = _client()
    if not c:
        return None
    try:
        row = {**error, "user_id": user_id, "course_id": course_id}
        # Remove Python-only fields that don't exist in Supabase
        row.pop("id", None)            # Supabase generates UUID
        for k in list(row.keys()):
            if hasattr(row[k], "isoformat"):
                row[k] = row[k].isoformat()
        res = c.table("homework_errors").insert(row).execute()
        return res.data[0] if res.data else None
    except Exception:
        return None


def update_error(user_id: str, error_id: str, updates: dict) -> dict | None:
    c = _client()
    if not c:
        return None
    try:
        res = c.table("homework_errors") \
            .update(updates) \
            .eq("id", error_id) \
            .eq("user_id", user_id) \
            .execute()
        return res.data[0] if res.data else None
    except Exception:
        return None


def get_trending_topics(course_id: str, limit: int = 5) -> list[dict]:
    """
    Aggregate unresolved errors across ALL users for a course.
    Returns [{"topic": str, "count": int}, ...] sorted by count desc.
    """
    c = _client()
    if not c:
        return []
    try:
        res = c.table("homework_errors") \
            .select("topic") \
            .eq("course_id", course_id) \
            .eq("status", "unresolved") \
            .execute()
        counts = Counter(row["topic"].replace("_", " ") for row in (res.data or []) if row.get("topic"))
        return [{"topic": t, "count": n} for t, n in counts.most_common(limit)]
    except Exception:
        return []


# ── Documents Registry ─────────────────────────────────────────────────────────

def get_documents(user_id: str, course_id: str | None = None) -> list[dict] | None:
    c = _client()
    if not c:
        return None
    try:
        q = c.table("documents_registry").select("*").eq("user_id", user_id)
        if course_id:
            q = q.eq("course_id", course_id)
        res = q.order("uploaded_at", desc=False).execute()
        return res.data or []
    except Exception:
        return None


# ── Calendar / Assignments ─────────────────────────────────────────────────────

def get_assignments(user_id: str, course_id: str | None = None) -> list[dict] | None:
    c = _client()
    if not c:
        return None
    try:
        q = c.table("assignments").select("*").eq("user_id", user_id)
        if course_id:
            q = q.eq("course_id", course_id)
        res = q.order("due_date", desc=False).execute()
        return res.data or []
    except Exception:
        return None


def add_assignments(user_id: str, events: list[dict]) -> list[dict] | None:
    """Bulk-insert calendar events for a user."""
    c = _client()
    if not c:
        return None
    try:
        rows = []
        for ev in events:
            row = {**ev, "user_id": user_id}
            row.pop("id", None)   # Supabase generates UUID
            for k in list(row.keys()):
                if hasattr(row[k], "isoformat"):
                    row[k] = row[k].isoformat()
            rows.append(row)
        res = c.table("assignments").insert(rows).execute()
        return res.data or []
    except Exception:
        return None


def update_assignment(user_id: str, event_id: str, updates: dict) -> dict | None:
    c = _client()
    if not c:
        return None
    try:
        res = (
            c.table("assignments")
            .update(updates)
            .eq("id", event_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception:
        return None


def delete_assignment(user_id: str, event_id: str) -> bool:
    c = _client()
    if not c:
        return False
    try:
        c.table("assignments") \
            .delete() \
            .eq("id", event_id) \
            .eq("user_id", user_id) \
            .execute()
        return True
    except Exception:
        return False


def add_document(user_id: str, doc: dict) -> dict | None:
    c = _client()
    if not c:
        return None
    try:
        row = {**doc, "user_id": user_id}
        for k in list(row.keys()):
            if hasattr(row[k], "isoformat"):
                row[k] = row[k].isoformat()
        res = c.table("documents_registry").insert(row).execute()
        return res.data[0] if res.data else None
    except Exception:
        return None
