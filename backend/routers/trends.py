"""
GET /api/trending-topics/{course_id}
Crowdsourced difficulty heatmap — aggregates unresolved errors across all users.
Falls back to local JSON when Supabase is not configured.
"""
from __future__ import annotations
import os
import json
from collections import Counter
from typing import Literal
from fastapi import APIRouter

router = APIRouter()

_ERRORS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "homework_errors")


def _local_trending(course_id: str, limit: int = 5) -> list[dict]:
    """Count unresolved topics from local JSON files."""
    path = os.path.join(_ERRORS_DIR, f"{course_id}_errors.json")
    if not os.path.isfile(path):
        return []
    with open(path) as f:
        data = json.load(f)
    counts = Counter(
        e.get("topic", "").replace("_", " ")
        for e in data.get("errors", [])
        if e.get("status", "unresolved") == "unresolved" and e.get("topic")
    )
    return [{"topic": t, "count": n} for t, n in counts.most_common(limit)]


@router.get("/trending-topics/{course_id}")
async def trending_topics(course_id: Literal["math20c", "cse12"]):
    """
    Return the top struggling topics for this course across all users.
    Uses Supabase when configured, local JSON otherwise.
    """
    from services.supabase_service import get_trending_topics, is_configured
    if is_configured():
        topics = get_trending_topics(course_id)
    else:
        topics = _local_trending(course_id)
    return {"course_id": course_id, "trending": topics}
