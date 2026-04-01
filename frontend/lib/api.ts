import type {
  CourseId,
  SyllabusResponse,
  HomeworkError,
  HomeworkErrorsResponse,
  ErrorStatus,
  DeepDiveResponse,
  BriefingResponse,
  UploadResponseExtended,
  TrendingTopicsResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Retrieve the logged-in Supabase user ID, if any. Used as X-User-ID header. */
function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    // Supabase stores the session in localStorage under this key pattern
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    if (!keys.length) return null;
    const raw  = localStorage.getItem(keys[0]);
    if (!raw)  return null;
    const sess = JSON.parse(raw);
    return sess?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Build common headers for API calls, injecting user identity when available. */
function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  const uid = getUserId();
  if (uid) h["X-User-ID"] = uid;
  return h;
}

// --- Chat (SSE streaming) ---

export function streamChat(
  message: string,
  courseId: CourseId,
  conversationHistory: Array<{ role: string; content: string }>,
  onToken: (token: string) => void,
  onSources: (sources: Array<{ file: string; score: number; preview: string }>) => void,
  onDone: () => void,
  onError: (err: Error) => void
): () => void {
  let cancelled = false;

  (async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          message,
          course_id: courseId,
          conversation_history: conversationHistory,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          const event = JSON.parse(json);
          if (event.type === "text") onToken(event.delta);
          else if (event.type === "sources") onSources(event.sources);
          else if (event.type === "done") { onDone(); return; }
        }
      }
      onDone();
    } catch (err) {
      if (!cancelled) onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return () => { cancelled = true; };
}

// --- Syllabus ---

export async function getSyllabus(courseId: CourseId): Promise<SyllabusResponse> {
  const res = await fetch(`${API_URL}/api/syllabus/${courseId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Failed to load syllabus: ${res.status}`);
  return res.json();
}

// --- Homework Errors ---

export async function getHomeworkErrors(courseId: CourseId): Promise<HomeworkErrorsResponse> {
  const res = await fetch(`${API_URL}/api/homework-errors/${courseId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Failed to load errors: ${res.status}`);
  return res.json();
}

export async function logHomeworkError(
  courseId: CourseId,
  error: Omit<HomeworkError, "id" | "recorded_at">
): Promise<HomeworkError> {
  const res = await fetch(`${API_URL}/api/homework-errors/${courseId}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(error),
  });
  if (!res.ok) throw new Error(`Failed to log error: ${res.status}`);
  return res.json();
}

/** Legacy resolve toggle — kept for backward compat. */
export async function resolveHomeworkError(
  courseId: CourseId,
  errorId: string,
  resolved: boolean
): Promise<HomeworkError> {
  const res = await fetch(`${API_URL}/api/homework-errors/${courseId}`, {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ error_id: errorId, resolved }),
  });
  if (!res.ok) throw new Error(`Failed to resolve error: ${res.status}`);
  return res.json();
}

/** Update the 3-state status: unresolved → reviewing → mastered. */
export async function updateErrorStatus(
  courseId: CourseId,
  errorId: string,
  status: ErrorStatus
): Promise<HomeworkError> {
  const res = await fetch(
    `${API_URL}/api/homework-errors/${courseId}/${errorId}/status`,
    {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) throw new Error(`Failed to update status: ${res.status}`);
  return res.json();
}

/** Daily Triton briefing — stale errors + AI-generated greeting. */
export async function getBriefing(courseId: CourseId): Promise<BriefingResponse> {
  const res = await fetch(`${API_URL}/api/homework-errors/${courseId}/briefing`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Briefing failed: ${res.status}`);
  return res.json();
}

/** Generate a 3-step recovery plan for an error via RAG + Ollama. */
export async function getDeepDive(
  courseId: CourseId,
  errorId: string
): Promise<DeepDiveResponse> {
  const res = await fetch(
    `${API_URL}/api/homework-errors/${courseId}/${errorId}/deep-dive`,
    { method: "POST", headers: headers() }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Deep-dive failed" }));
    throw new Error(err.detail || `Deep-dive failed: ${res.status}`);
  }
  return res.json();
}

// --- Documents ---

export async function uploadPdf(
  file: File,
  courseId: CourseId,
  documentType: string
): Promise<UploadResponseExtended> {
  const form = new FormData();
  form.append("file", file);
  form.append("course_id", courseId);
  form.append("document_type", documentType);

  const res = await fetch(`${API_URL}/api/upload-pdf`, {
    method: "POST",
    headers: headers(),   // no Content-Type — browser sets multipart boundary
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function getDocuments(courseId?: CourseId) {
  const url = courseId
    ? `${API_URL}/api/documents?course_id=${courseId}`
    : `${API_URL}/api/documents`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Failed to load documents: ${res.status}`);
  return res.json();
}

// --- Calendar ---

export async function getCalendarEvents(courseId: string): Promise<import("./types").CalendarEventsResponse> {
  const res = await fetch(`${API_URL}/api/calendar/events/${courseId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Calendar fetch failed: ${res.status}`);
  return res.json();
}

export async function ingestText(
  text: string,
  courseId: string,
  source: string = "scraped",
  googleDocId?: string
): Promise<import("./types").IngestResponse> {
  const res = await fetch(`${API_URL}/api/calendar/ingest`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ text, course_id: courseId, source, google_doc_id: googleDocId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Ingest failed" }));
    throw new Error(err.detail || `Ingest failed: ${res.status}`);
  }
  return res.json();
}

export async function addCalendarEvent(
  courseId: string,
  event: { title: string; type: string; due_date: string; weight?: number; description?: string }
): Promise<import("./types").CalendarEvent> {
  const res = await fetch(`${API_URL}/api/calendar/events/${courseId}`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Add event failed: ${res.status}`);
  return res.json();
}

export async function toggleEventComplete(eventId: string, completed: boolean) {
  const res = await fetch(`${API_URL}/api/calendar/events/${eventId}/complete`, {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new Error(`Toggle failed: ${res.status}`);
  return res.json();
}

export async function deleteCalendarEvent(eventId: string) {
  const res = await fetch(`${API_URL}/api/calendar/events/${eventId}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
}

// --- Course Management ---

export async function deleteCourseData(courseId: string): Promise<{ deleted: string; files_removed: string[] }> {
  const res = await fetch(`${API_URL}/api/courses/${courseId}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Delete course failed: ${res.status}`);
  return res.json();
}

// --- Crowdsourced Trends ---

export async function getTrendingTopics(courseId: CourseId): Promise<TrendingTopicsResponse> {
  const res = await fetch(`${API_URL}/api/trending-topics/${courseId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Trending topics failed: ${res.status}`);
  return res.json();
}
