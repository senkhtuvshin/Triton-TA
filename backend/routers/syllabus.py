"""
GET /api/syllabus/{course_id} — Countdown + suggested problems + all events.
Accepts any course_id — works for built-in courses (math20c, cse12) and
dynamically-added ones (math_18, cse_105, etc.).
"""
from fastapi import APIRouter
from models.schemas import SyllabusResponse, NextExamSummary, PracticeProblem, SyllabusEvent
from services.countdown_service import get_next_exam, get_suggested_problems, load_syllabus

router = APIRouter()


@router.get("/syllabus/{course_id}", response_model=SyllabusResponse)
async def get_syllabus(course_id: str):
    exam_info = get_next_exam(course_id)
    suggested = get_suggested_problems(course_id)
    syllabus = load_syllabus(course_id)

    next_exam = None
    if exam_info:
        next_exam = NextExamSummary(
            exam_title=exam_info["exam_title"],
            exam_date=exam_info["exam_date"],
            days_remaining=exam_info["days_remaining"],
            urgency=exam_info["urgency"],
            topics_covered=exam_info["topics_covered"],
        )

    all_events = [SyllabusEvent(**e) for e in syllabus.get("events", [])]
    suggested_problems = [PracticeProblem(**p) for p in suggested]

    return SyllabusResponse(
        course_id=course_id,
        next_exam=next_exam,
        suggested_problems=suggested_problems,
        all_events=all_events,
    )
