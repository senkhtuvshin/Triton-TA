"""
from __future__ import annotations
# Midterm Countdown Service.
#
# - Reads syllabi JSON files to find the next upcoming exam.
# - Computes days remaining and urgency level.
- Suggests practice problems by intersecting exam topics with student's weak areas.
"""
import os
import json
from datetime import date


def _data_path(filename: str) -> str:
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", filename)


def load_syllabus(course_id: str) -> dict:
    path = _data_path(f"syllabi/{course_id}_syllabus.json")
    if not os.path.isfile(path):
        return {"events": []}
    with open(path) as f:
        return json.load(f)


def load_homework_errors(course_id: str) -> dict:
    path = _data_path(f"homework_errors/{course_id}_errors.json")
    if not os.path.isfile(path):
        return {"errors": []}
    with open(path) as f:
        return json.load(f)


def _get_urgency(days: int) -> str:
    if days <= 3:
        return "critical"
    if days <= 7:
        return "high"
    if days <= 14:
        return "medium"
    return "low"


def _load_calendar_exams(course_id: str) -> list[dict]:
    """
    Pull EXAM-type events from the calendar JSON store
    (data/calendar/{course_id}_events.json) so manually added events
    are included in the countdown alongside syllabus events.
    """
    path = _data_path(f"calendar/{course_id}_events.json")
    if not os.path.isfile(path):
        return []
    with open(path) as f:
        data = json.load(f)
    exams = []
    for ev in data.get("events", []):
        if ev.get("type") != "EXAM":
            continue
        due = ev.get("due_date", "TBD")
        if not due or due == "TBD":
            continue
        # Normalise to the shape countdown_service expects
        exams.append({
            "title":             ev["title"],
            "date":              due,
            "type":              "midterm",      # treated as midterm for urgency purposes
            "topics_covered":    [],
            "practice_problems": [],
            "_source":           "calendar",
        })
    return exams


def get_next_exam(course_id: str) -> dict | None:
    syllabus = load_syllabus(course_id)
    today    = date.today()

    # Merge syllabus events with calendar EXAM entries so manual adds show up
    all_candidates = list(syllabus.get("events", [])) + _load_calendar_exams(course_id)

    upcoming = []
    for e in all_candidates:
        if e.get("type") not in ("midterm", "final"):
            continue
        try:
            exam_date = date.fromisoformat(e["date"])
        except (ValueError, KeyError):
            continue
        if exam_date > today:
            upcoming.append(e)

    if not upcoming:
        return None

    upcoming.sort(key=lambda e: e["date"])
    next_exam      = upcoming[0]
    days_remaining = (date.fromisoformat(next_exam["date"]) - today).days

    return {
        "exam_title":     next_exam["title"],
        "exam_date":      next_exam["date"],
        "days_remaining": days_remaining,
        "urgency":        _get_urgency(days_remaining),
        "topics_covered": next_exam.get("topics_covered", []),
        "_raw":           next_exam,
    }


def get_suggested_problems(course_id: str) -> list[dict]:
    """
    Algorithm:
    1. Get topics on the next exam.
    2. Load unresolved homework errors.
    3. Intersect error topics with exam topics → 'high' priority problems.
    4. Supplement with general exam problems.
    """
    exam_info = get_next_exam(course_id)
    if not exam_info:
        return []

    exam_topics = set(exam_info["topics_covered"])
    errors_data = load_homework_errors(course_id)
    weak_topics = {
        e["topic"]
        for e in errors_data.get("errors", [])
        if not e.get("resolved", False)
    }
    priority_topics = weak_topics & exam_topics

    suggestions = []
    for problem in exam_info["_raw"].get("practice_problems", []):
        is_weak = problem.get("topic") in priority_topics
        suggestions.append({
            "source": problem["source"],
            "problem": problem["problem"],
            "topic": problem["topic"],
            "priority": "high" if is_weak else "normal",
            "reason": f"Known weak area: {problem['topic']}" if is_weak else "Exam coverage",
        })

    suggestions.sort(key=lambda p: 0 if p["priority"] == "high" else 1)
    return suggestions
