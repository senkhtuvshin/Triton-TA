// TypeScript mirrors of backend Pydantic schemas

/** Loose string type — allows built-in and user-added courses. */
export type CourseId = string;

/** A course entry in the registry (built-in or user-created). */
export interface Course {
  id: string;       // slug e.g. "math20c", "cse_105"
  code: string;     // display code e.g. "MATH 20C", "CSE 105"
  name: string;     // subtitle e.g. "Multivariable Calculus"
}

/** Initial seed courses — shown on first visit, deleteable like any other course. */
export const DEFAULT_COURSES: Course[] = [
  { id: "math20c", code: "MATH 20C", name: "Multivariable Calculus" },
  { id: "cse12",   code: "CSE 12",   name: "Data Structures" },
];

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatMessage extends ConversationMessage {
  id: string;
  sources?: SourceCitation[];
  timestamp: Date;
  streaming?: boolean;
}

export interface SourceCitation {
  file: string;
  score: number;
  preview: string;
}

export interface PracticeProblem {
  source: string;
  problem: string;
  topic: string;
  priority: "high" | "normal";
  reason?: string;
}

export interface NextExamSummary {
  exam_title: string;
  exam_date: string;
  days_remaining: number;
  urgency: "critical" | "high" | "medium" | "low";
  topics_covered: string[];
}

export interface SyllabusEvent {
  id: string;
  type: "midterm" | "final" | "homework_due" | "lecture";
  title: string;
  date: string;
  topics_covered: string[];
  practice_problems: PracticeProblem[];
}

export interface SyllabusResponse {
  course_id: string;
  next_exam?: NextExamSummary;
  suggested_problems: PracticeProblem[];
  all_events: SyllabusEvent[];
}

// ── Homework Errors ──────────────────────────────────────────────────────

export type ErrorStatus = "unresolved" | "reviewing" | "mastered";

export interface HomeworkError {
  id?: string;
  homework_id: string;
  problem: string;
  topic: string;
  subtopic: string;
  description: string;
  recorded_at?: string;
  status: ErrorStatus;
  resolved: boolean;
  attempts: number;
}

export interface HomeworkErrorsResponse {
  course_id: string;
  errors: HomeworkError[];
  total_unresolved: number;
}

// ── Deep-Dive Recovery Plan ──────────────────────────────────────────────

export interface DeepDiveResponse {
  error_id: string;
  refresher: string;
  simplified_problem: string;
  pdf_pointer: string;
  generated_at: string;
}

// ── Documents ────────────────────────────────────────────────────────────

export interface DocumentInfo {
  document_id: string;
  file_name: string;
  course_id: string;
  document_type: string;
  chunks_indexed: number;
  uploaded_at: string;
}

export interface UploadResponse {
  status: string;
  chunks_indexed: number;
  document_id: string;
  message: string;
}

/** Lookup helpers for built-in courses; extend as needed for custom ones. */
export const COURSE_NAMES: Record<string, string> = {
  math20c: "MATH 20C",
  cse12:   "CSE 12",
};

export const COURSE_FULL_NAMES: Record<string, string> = {
  math20c: "Multivariable Calculus",
  cse12:   "Data Structures",
};

/** Get display code for any course id (falls back to uppercased slug). */
export function getCourseCode(id: string): string {
  return COURSE_NAMES[id] ?? id.replace(/_/g, " ").toUpperCase();
}

/** Get subtitle for any course id (empty string if unknown). */
export function getCourseName(id: string): string {
  return COURSE_FULL_NAMES[id] ?? "";
}

export const STATUS_LABELS: Record<ErrorStatus, string> = {
  unresolved: "Unresolved",
  reviewing:  "Reviewing",
  mastered:   "Mastered",
};

export const STATUS_CYCLE: Record<ErrorStatus, ErrorStatus> = {
  unresolved: "reviewing",
  reviewing:  "mastered",
  mastered:   "unresolved",
};

// ── Daily Triton Briefing ────────────────────────────────────────────────

export interface BriefingResponse {
  course_id:        string;
  has_stale_errors: boolean;
  stale_count:      number;
  stale_topics:     string[];
  greeting:         string;
  next_exam_title?: string;
  days_until_exam?: number;
  is_new_course:    boolean;   // true when no errors logged yet for this course
}

// ── Crowdsourced Trending Topics ─────────────────────────────────────────

export interface TrendingTopic {
  topic: string;
  count: number;
}

export interface TrendingTopicsResponse {
  course_id: string;
  trending:  TrendingTopic[];
}

// ── Calendar Events ───────────────────────────────────────────────────────

export type CalendarEventType =
  | "EXAM"
  | "ASSIGNMENT"
  | "QUIZ"
  | "LECTURE"
  | "OFFICE_HOURS";

export type CalendarEventSource = "manual" | "scraped" | "syllabus" | "google_doc";

export interface CalendarEvent {
  id:          string;
  course_id:   string;
  title:       string;
  type:        CalendarEventType;
  due_date:    string;           // ISO-8601 or "TBD"
  weight:      number;           // 0–100 percentage of grade
  description: string;
  completed:   boolean;
  source:      CalendarEventSource;
  created_at:  string;
}

export interface CalendarEventsResponse {
  course_id: string;
  events:    CalendarEvent[];
  total:     number;
}

export interface IngestResponse {
  status:           string;
  events_extracted: number;
  events:           CalendarEvent[];
  draft_events:     CalendarEvent[];   // date=TBD exam/midterm/final lines for manual review
}

/** Visual colour per event type for the calendar UI. */
export const EVENT_COLORS: Record<CalendarEventType, string> = {
  EXAM:         "#EF4444",   // red
  ASSIGNMENT:   "#C69214",   // UCSD gold
  QUIZ:         "#3B82F6",   // blue
  LECTURE:      "#6B7280",   // gray
  OFFICE_HOURS: "#10B981",   // emerald
};

export const EVENT_LABELS: Record<CalendarEventType, string> = {
  EXAM:         "Exam",
  ASSIGNMENT:   "Assignment",
  QUIZ:         "Quiz",
  LECTURE:      "Lecture",
  OFFICE_HOURS: "Office Hours",
};

// ── Syllabus Extraction ──────────────────────────────────────────────────

export interface ExtractedSyllabusEvent {
  type: "midterm" | "final" | "homework_due" | "quiz" | "lecture";
  title: string;
  date: string;
  topics_covered: string[];
}

export interface UploadResponseExtended extends UploadResponse {
  summary_spark: string[];
  extracted_events: ExtractedSyllabusEvent[];
}
