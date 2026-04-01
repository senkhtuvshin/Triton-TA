from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


# --- Chat ---

class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    course_id: Literal["math20c", "cse12"]
    conversation_history: list[ConversationMessage] = Field(default_factory=list, max_length=20)


class SourceCitation(BaseModel):
    file: str
    score: float
    chunk_preview: str


# --- Documents ---

class UploadResponse(BaseModel):
    status: str
    chunks_indexed: int
    document_id: str
    message: str


class DocumentInfo(BaseModel):
    document_id: str
    file_name: str
    course_id: str
    document_type: str
    chunks_indexed: int
    uploaded_at: str


# --- Syllabus ---

class PracticeProblem(BaseModel):
    source: str
    problem: str
    topic: str
    priority: Literal["high", "normal"] = "normal"
    reason: Optional[str] = None


class SyllabusEvent(BaseModel):
    id: str
    type: Literal["midterm", "final", "homework_due", "lecture"]
    title: str
    date: str
    topics_covered: list[str] = []
    practice_problems: list[PracticeProblem] = []


class NextExamSummary(BaseModel):
    exam_title: str
    exam_date: str
    days_remaining: int
    urgency: Literal["critical", "high", "medium", "low"]
    topics_covered: list[str]


class SyllabusResponse(BaseModel):
    course_id: str
    next_exam: Optional[NextExamSummary] = None
    suggested_problems: list[PracticeProblem] = []
    all_events: list[SyllabusEvent] = []


# --- Homework Errors ---

ErrorStatus = Literal["unresolved", "reviewing", "mastered"]


class HomeworkError(BaseModel):
    id: Optional[str] = None
    homework_id: str
    problem: str
    topic: str
    subtopic: str = ""
    description: str = ""
    recorded_at: Optional[datetime] = None
    status: ErrorStatus = "unresolved"
    resolved: bool = False          # kept for backward compat; derived from status
    attempts: int = 1


class HomeworkErrorsResponse(BaseModel):
    course_id: str
    errors: list[HomeworkError]
    total_unresolved: int


class ResolveErrorRequest(BaseModel):
    error_id: str
    resolved: bool


class UpdateStatusRequest(BaseModel):
    status: ErrorStatus


# --- Deep-Dive Recovery Plan ---

class DeepDiveResponse(BaseModel):
    error_id: str
    refresher: str            # 2-sentence conceptual refresher
    simplified_problem: str   # Easier version of the problem
    pdf_pointer: str          # Specific section/slide to review
    generated_at: datetime


# --- Daily Triton Briefing ---

class BriefingResponse(BaseModel):
    course_id: str
    has_stale_errors: bool          # unresolved errors older than 24 h
    stale_count: int
    stale_topics: list[str]         # e.g. ["gradient", "chain_rule"]
    greeting: str                   # AI-generated 1-sentence welcome (or static)
    next_exam_title: Optional[str] = None
    days_until_exam: Optional[int]  = None
    is_new_course: bool = False     # True when course has no errors at all yet


# --- Syllabus Extraction ---

class ExtractedSyllabusEvent(BaseModel):
    type: Literal["midterm", "final", "homework_due", "quiz", "lecture"]
    title: str
    date: str                       # YYYY-MM-DD
    topics_covered: list[str] = []


class UploadResponseExtended(BaseModel):
    status: str
    chunks_indexed: int
    document_id: str
    message: str
    summary_spark: list[str] = []           # 3 bullet points for syllabus uploads
    extracted_events: list[ExtractedSyllabusEvent] = []
