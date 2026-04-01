"""
Ollama LLM service — streaming and non-streaming via local Ollama server.
Ollama must be running: https://ollama.com
Recommended model: ollama pull llama3.2
"""
from __future__ import annotations
import os
import re
import json
import ollama


def _model() -> str:
    return os.getenv("MODEL_ID", "llama3.2")


# ── Streaming ──────────────────────────────────────────────────────────────

def stream_chat(
    system_prompt: str,
    messages: list[dict],
    max_tokens: int | None = None,
):
    """Streaming chat for the Socratic TA endpoint."""
    full_messages = [{"role": "system", "content": system_prompt}] + messages
    return ollama.chat(model=_model(), messages=full_messages, stream=True)


# ── Helpers ────────────────────────────────────────────────────────────────

def _call(prompt: str) -> str:
    """Single non-streaming Ollama call, returns raw content string."""
    response = ollama.chat(
        model=_model(),
        messages=[{"role": "user", "content": prompt}],
        stream=False,
    )
    return response.message.content.strip()


def _extract_label(text: str, label: str) -> str:
    """Extract a labelled line value: 'LABEL: <content>'."""
    pattern = rf"(?i){re.escape(label)}\s*:\s*(.+?)(?=\n[A-Z_]+:|$)"
    m = re.search(pattern, text, re.DOTALL)
    return m.group(1).strip().replace("\n", " ") if m else ""


def _extract_all_labels(text: str, label: str) -> list[str]:
    """Extract all lines matching 'LABEL: <content>'."""
    pattern = rf"(?i){re.escape(label)}\s*:\s*(.+)"
    return [m.group(1).strip() for m in re.finditer(pattern, text)]


# ── Deep-Dive Recovery Plan ────────────────────────────────────────────────

def generate_deep_dive(
    topic: str,
    subtopic: str,
    description: str,
    rag_context: str,
) -> dict:
    """
    Returns { refresher, simplified_problem, pdf_pointer }.
    Uses a labelled-line format for reliable extraction from llama3.2.
    """
    context_section = (
        f"Relevant course material:\n{rag_context}"
        if rag_context
        else "No indexed PDFs available — use general course knowledge."
    )

    prompt = f"""You are a UCSD TA. A student made this mistake:

Topic: {topic}
Subtopic: {subtopic or "N/A"}
Mistake: {description or "No description provided"}

{context_section}

Write a short recovery plan using EXACTLY this format:

REFRESHER: <2 sentences explaining the core concept the student misunderstood>
SIMPLIFIED_PROBLEM: <one simpler practice question with a brief hint>
PDF_POINTER: <the specific lecture topic or textbook section to revisit, and why>

Only output the three labelled lines — nothing else."""

    raw = _call(prompt)

    return {
        "refresher": _extract_label(raw, "REFRESHER")
            or f"Review the definition and properties of {topic} in your lecture notes.",
        "simplified_problem": _extract_label(raw, "SIMPLIFIED_PROBLEM")
            or f"Try a basic {topic} example with concrete numbers before generalising.",
        "pdf_pointer": _extract_label(raw, "PDF_POINTER")
            or f"Search your indexed PDFs for '{topic}' and study the worked examples.",
    }


# ── Daily Triton Briefing ──────────────────────────────────────────────────

def generate_briefing(
    course_name: str,
    stale_topics: list[str],
    next_exam_title: str | None,
    days_until_exam: int | None,
) -> str:
    """
    Generate a 1-sentence personalised welcome greeting.
    """
    topics_str = ", ".join(stale_topics) if stale_topics else "none"
    exam_hint = (
        f"Their next exam is {next_exam_title} in {days_until_exam} days."
        if next_exam_title and days_until_exam is not None
        else ""
    )

    prompt = f"""You are a friendly UCSD TA. Write ONE welcoming sentence to greet a student returning to study.

Course: {course_name}
Unresolved topics they need to review: {topics_str}
{exam_hint}

Rules:
- Exactly one sentence.
- Be warm and specific — mention one topic or the exam if relevant.
- End with a question that invites them to start studying.
- No filler like "Welcome back!" at the start — be direct and human.

GREETING: <your one sentence>"""

    raw = _call(prompt)
    greeting = _extract_label(raw, "GREETING")

    # Fallback if label not found
    if not greeting:
        greeting = raw.split("\n")[0].strip()

    if not greeting:
        topic = stale_topics[0] if stale_topics else "your coursework"
        greeting = (
            f"You have {len(stale_topics)} unresolved topic(s) in {course_name} — "
            f"want to start with {topic}?"
        )

    return greeting


# ── Universal Calendar Event Extraction ────────────────────────────────────

_DOW_MAP = {
    "sun": 6, "sunday": 6,
    "mon": 0, "monday": 0,
    "tue": 1, "tuesday": 1,
    "wed": 2, "wednesday": 2,
    "thu": 3, "thursday": 3,
    "fri": 4, "friday": 4,
    "sat": 5, "saturday": 5,
}

_MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

_DEFAULT_YEAR = 2026

# Keywords that mark a line as high-priority for extraction
_EXAM_KEYWORDS = ("midterm", "final", "exam", "test", "quiz")

# CSS-like line detector — skip these during cleaning
_CSS_LINE_RE = re.compile(
    r"^\s*[\w\s.#*:,\-\[\]'\"=^~>+()]+\s*\{"  # CSS selector + opening brace
    r"|^\s*[\w-]+\s*:\s*.+;\s*$"               # property: value;
    r"|^\s*@(media|import|charset|keyframes)",  # @-rules
    re.IGNORECASE,
)


def _clean_text(text: str) -> str:
    """
    Pre-process raw scraped/pasted text before it hits the LLM.

    Removes:
      - HTML tags  (<span class="...">)
      - HTML entities  (&amp; → &)
      - CSS blocks  { color: red; }  and CSS rule lines
      - Duplicate "Office Hours" lines (keep the first occurrence only)

    Keeps:
      - All lines with actual content (assignments, dates, headings, etc.)
    """
    import html as _html

    # 1. Unescape HTML entities
    text = _html.unescape(text)
    # 2. Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # 3. Remove inline CSS blocks  { … }
    text = re.sub(r"\{[^}]*\}", " ", text)
    # 4. Collapse multiple spaces/tabs on a single line
    text = re.sub(r"[ \t]{2,}", " ", text)

    lines = text.splitlines()
    clean: list[str] = []
    oh_count = 0

    for line in lines:
        s = line.strip()
        if not s:
            continue
        # Skip lines that look like CSS rules
        if _CSS_LINE_RE.search(s):
            continue
        # Deduplicate office-hours lines — keep the first instance
        if re.search(r"office\s+hours?", s, re.IGNORECASE):
            oh_count += 1
            if oh_count > 1:
                continue
        clean.append(s)

    cleaned = "\n".join(clean)
    original_len = len(text)
    print(
        f"[Triton Clean] {original_len:,} chars → {len(cleaned):,} chars "
        f"({100*(original_len-len(cleaned))//max(original_len,1)}% removed, "
        f"{oh_count} office-hours lines deduped)"
    )
    return cleaned


def _normalise_date(raw: str) -> str:
    """
    Convert any common date representation to ISO-8601 YYYY-MM-DD.
    Assumes year = 2026 when the year is absent.

    Handles:
      • 4/24           →  2026-04-24
      • 4/24/26        →  2026-04-24
      • April 24       →  2026-04-24
      • Apr 24, 2026   →  2026-04-24
      • 24 April       →  2026-04-24
      • 2026-04-24     →  2026-04-24  (pass-through)
      • "TBD" / junk   →  "TBD"
    """
    from datetime import date as _date

    raw = raw.strip()
    if not raw or raw.upper() in ("TBD", "N/A", "NONE", "?"):
        return "TBD"

    # ── Strip leading day-of-week name (e.g. "Friday 4/24" → "4/24") ──
    raw = re.sub(
        r"^(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?"
        r"|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)[,.]?\s+",
        "",
        raw,
        flags=re.IGNORECASE,
    )
    # ── Strip trailing parenthetical  (e.g. "4/24 (during lecture)" → "4/24")
    raw = re.sub(r"\s*\([^)]*\)\s*$", "", raw).strip()

    # ── Already ISO ────────────────────────────────────────────────────
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw

    # ── M/D  or  M/D/YY  or  M/D/YYYY ────────────────────────────────
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$", raw)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        yr = m.group(3)
        year = (int(yr) + 2000 if yr and int(yr) < 100 else int(yr)) if yr else _DEFAULT_YEAR
        try:
            return _date(year, month, day).isoformat()
        except ValueError:
            return "TBD"

    # ── Month Day[,] [Year]  (April 24 / Apr 24 / April 24, 2026) ─────
    m = re.match(
        r"^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]*(\d{4})?$",
        raw,
    )
    if m:
        mo = _MONTH_MAP.get(m.group(1).lower())
        if mo:
            try:
                return _date(int(m.group(3) or _DEFAULT_YEAR), mo, int(m.group(2))).isoformat()
            except ValueError:
                return "TBD"

    # ── Day Month [Year]  (24 April / 24 Apr 2026) ─────────────────────
    m = re.match(
        r"^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?$",
        raw,
    )
    if m:
        mo = _MONTH_MAP.get(m.group(2).lower())
        if mo:
            try:
                return _date(int(m.group(3) or _DEFAULT_YEAR), mo, int(m.group(1))).isoformat()
            except ValueError:
                return "TBD"

    return "TBD"


def _correct_date_to_dow(date_str: str, target_dow: int) -> str:
    """
    If `date_str` does not fall on `target_dow` (0=Mon … 6=Sun),
    slide to the nearest date (within ±3 days) that does.
    Returns the corrected ISO-8601 string, or the original if no match found.
    """
    from datetime import date, timedelta
    try:
        d = date.fromisoformat(date_str)
    except ValueError:
        return date_str

    actual_dow = d.weekday()    # 0=Mon … 6=Sun
    if actual_dow == target_dow:
        return date_str         # already correct

    # Search ±3 days, prefer forward
    for delta in [1, -1, 2, -2, 3, -3]:
        candidate = d + timedelta(days=delta)
        if candidate.weekday() == target_dow:
            return candidate.isoformat()

    return date_str             # give up, keep original


# Matches one date token, optionally preceded by a day-of-week name,
# optionally followed by a parenthetical note like "(8-11am)"
_DATE_TOKEN_RE = re.compile(
    r"(?:(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?"
    r"|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s+)?"
    r"(?:"
    r"\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?"                   # M/D or M/D/YY
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"  # Month name …
    r"[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?"                   # … followed by day
    r")"
    r"(?:\s*\([^)]*\))?",                                    # optional (note)
    re.IGNORECASE,
)

# Matches "... scheduled for <date-list>." across line breaks (re.DOTALL).
# Group 1 = full context (used to detect "final"); Group 2 = date-list chunk.
_SCHEDULED_FOR_RE = re.compile(
    r"((?:exams?|midterms?|finals?).{0,120}?"
    r"(?:scheduled\s+for|are\s+on|will\s+be\s+on|held\s+on))\s+"
    r"(.{10,400}?)"           # date list — up to 400 chars, lazy
    r"(?=\.\s|\.\n|\n\n|$)",  # stop at sentence-end or paragraph break
    re.IGNORECASE | re.DOTALL,
)


def _expand_inline_dates(text: str) -> str:
    """
    Detect "scheduled for Date1, Date2, Date3" patterns anywhere in the text
    — including across line breaks — and inject individual labeled lines at
    the top so the LLM and fuzzy scanner see one event per line.

    Example (the Canvas page wraps after the first date):
        "... scheduled for Friday 4/24 (during lecture time),
         Friday 5/15 (during lecture time), and Saturday 6/6 (8-11am)."

    Injected:
        EXAM DATE: Midterm 1 on Friday 4/24 (during lecture time)
        EXAM DATE: Midterm 2 on Friday 5/15 (during lecture time)
        EXAM DATE: Final Exam on Saturday 6/6 (8-11am)
    """
    injected: list[str] = []

    # Search the FULL text (not line-by-line) so wrapped sentences are handled
    for m in _SCHEDULED_FOR_RE.finditer(text):
        ctx        = m.group(1).lower()   # context before "scheduled for"
        date_chunk = m.group(2)

        tokens = [t.strip() for t in _DATE_TOKEN_RE.findall(date_chunk) if t.strip()]
        if len(tokens) < 1:
            continue

        has_final = "final" in ctx
        n = len(tokens)

        for i, tok in enumerate(tokens):
            if i == n - 1 and has_final:
                label = "Final Exam"
            else:
                label = f"Midterm {i + 1}"
            injected.append(f"EXAM DATE: {label} on {tok}")

    if injected:
        block = "\n".join(injected)
        print(
            f"[Triton Expand] Injected {len(injected)} expanded exam lines:\n"
            + "\n".join(f"  {ln}" for ln in injected)
        )
        return block + "\n\n" + text

    print("[Triton Expand] No 'scheduled for' pattern found — text passed through unchanged")
    return text


def extract_calendar_events(text: str, course_id: str) -> list[dict]:
    """
    Universal Ingestor — extract structured academic events from ANY text.

    Improvements vs. v1:
      • _normalise_date() converts M/D, Month Day, etc. → ISO-8601 (year=2026 default)
      • High-priority lines (Midterm / Final / Exam) are surfaced separately in
        the prompt so the LLM cannot ignore them
      • Events with an unresolvable date are returned as is_draft=True instead
        of being silently dropped
      • Full raw LLM response is printed to stdout for debugging
      • DOW cross-verification still runs for all confirmed dates
    """
    import logging
    log = logging.getLogger(__name__)

    # ── Pre-process: clean → expand inline dates → truncate ──────────────────
    text = _clean_text(text)
    text = _expand_inline_dates(text)   # "scheduled for A, B, C" → 3 labeled lines
    truncated = text[:6000]
    course_label = course_id.replace("_", " ").upper()

    # ── Surface exam-keyword lines to the LLM explicitly ────────────────────
    priority_lines = [
        ln.strip()
        for ln in text.splitlines()
        if any(kw in ln.lower() for kw in _EXAM_KEYWORDS) and ln.strip()
    ]
    priority_block = ""
    if priority_lines:
        priority_block = (
            "\nHIGH-PRIORITY LINES — you MUST attempt to extract an event "
            "from every line below, even if the date format is unusual:\n"
            + "\n".join(f"  >> {ln}" for ln in priority_lines[:25])
            + "\n"
        )

    prompt = f"""You are extracting ALL academic deadlines and events from a course document for {course_label}.

CURRENT ACADEMIC YEAR: 2026. Every date without an explicit year is in 2026. Do NOT use 2025.
{priority_block}
FULL DOCUMENT TEXT:
{truncated}

RULES (follow every one strictly):
1. Extract every entry with a concrete action: "due", "submit by", "exam on", "quiz on", etc.
2. Bare topic mentions with no action ("we cover integration March 5") are NOT deadlines — skip.
3. Weight = percentage of final grade if stated (e.g. "worth 20%" → 20). Use 0 if not stated.
4. DATES — output in YYYY-MM-DD. Year is always 2026 unless the text says otherwise.
   Accept any of these input formats and convert them:
     M/D        (4/24   → 2026-04-24)
     Month Day  (April 24 → 2026-04-24)
     ISO        (2026-04-24 → pass through unchanged)
   Use "TBD" ONLY if absolutely no date information exists at all.
5. MULTIPLE DATES IN ONE SENTENCE: A single sentence may contain multiple dates.
   Output one CALEVENT line PER DATE — do NOT merge them.
   Example: "exams on Friday 4/24, Friday 5/15, and Saturday 6/6" → THREE separate CALEVENT lines.
   If labels like "EXAM DATE: Midterm 1 on ..." appear above, use those as your titles.
6. DAY-OF-WEEK (CRITICAL):
   - If the text explicitly names a weekday (e.g. "Friday April 24" or "Thursday, 4/24"),
     put that weekday abbreviation in the DOW field.
   - The named weekday is GROUND TRUTH. If your numeric date does not land on that weekday,
     ADJUST the numeric date until it matches — do not keep a wrong date just because it
     matches the number in the text.
   - Example: "Friday April 24" → if April 24 is not a Friday, use the nearest Friday
     (April 24 2026 IS a Friday — output 2026-04-24 | Fri).
   - Use "NONE" if no weekday name appears in the source text.
7. NEVER omit a Midterm, Final, or Exam line. If date is truly unknown, emit it with TBD.

Output EXACTLY this format, one line per event — no other text:
CALEVENT: <title> | <EXAM|ASSIGNMENT|QUIZ|LECTURE|OFFICE_HOURS> | <YYYY-MM-DD or TBD> | <weight int> | <description> | <Mon|Tue|Wed|Thu|Fri|Sat|Sun|NONE>

Examples:
CALEVENT: Midterm 1 | EXAM | 2026-04-24 | 25 | In-class exam covering chapters 1-4 | Fri
CALEVENT: Homework 3 | ASSIGNMENT | 2026-04-07 | 5 | Chain rule problems | Tue
CALEVENT: Final Exam | EXAM | TBD | 40 | Comprehensive final — date unconfirmed | NONE"""

    # ── Fix 5: Log raw LLM response ─────────────────────────────────────────
    raw = _call(prompt)
    print("\n" + "="*60)
    print(f"[Triton Ingest] LLM raw response for course={course_id}:")
    print(raw)
    print("="*60 + "\n")
    log.debug("[extract_calendar_events] raw=%s", raw)

    events: list[dict] = []
    valid_types = {"EXAM", "ASSIGNMENT", "QUIZ", "LECTURE", "OFFICE_HOURS"}

    calevent_lines  = [ln for ln in raw.splitlines() if ln.strip().upper().startswith("CALEVENT:")]
    print(f"[Triton Ingest] Found {len(calevent_lines)} CALEVENT lines out of {len(raw.splitlines())} total lines")

    for line in calevent_lines:
        line  = line.strip()
        parts = [p.strip() for p in line[9:].split("|")]
        if len(parts) < 3:
            print(f"[Triton Ingest]   SKIP (too few fields): {line}")
            continue

        title       = parts[0]
        raw_type    = parts[1].upper() if len(parts) > 1 else "ASSIGNMENT"
        raw_date    = parts[2] if len(parts) > 2 else "TBD"
        weight      = 0
        description = parts[4] if len(parts) > 4 else ""
        dow_hint    = parts[5].strip().lower() if len(parts) > 5 else "none"

        if len(parts) > 3:
            try:
                weight = max(0, min(100, int(parts[3].replace("%", ""))))
            except ValueError:
                pass

        # ── Fix 1: Loosen date parsing ──────────────────────────────────
        due_date = _normalise_date(raw_date)
        if due_date != raw_date:
            print(f"[Triton Ingest]   Date normalised: '{raw_date}' → '{due_date}' for '{title}'")

        # ── Normalise event type ────────────────────────────────────────
        if raw_type not in valid_types:
            t = raw_type.lower()
            if any(k in t for k in ("exam", "midterm", "final", "test")):
                raw_type = "EXAM"
            elif "quiz" in t:
                raw_type = "QUIZ"
            elif any(k in t for k in ("lecture", "class")):
                raw_type = "LECTURE"
            elif any(k in t for k in ("office", "oh")):
                raw_type = "OFFICE_HOURS"
            else:
                raw_type = "ASSIGNMENT"

        # Also promote by title when type was already overridden to ASSIGNMENT
        if raw_type == "ASSIGNMENT" and any(k in title.lower() for k in ("midterm", "final", "exam", "test")):
            raw_type = "EXAM"

        # ── DOW verification ────────────────────────────────────────────
        if due_date != "TBD" and dow_hint != "none":
            target = _DOW_MAP.get(dow_hint)
            if target is not None:
                corrected = _correct_date_to_dow(due_date, target)
                if corrected != due_date:
                    print(f"[Triton Ingest]   DOW corrected: '{due_date}' → '{corrected}' (hint={dow_hint}) for '{title}'")
                    due_date = corrected

        if not title:
            print(f"[Triton Ingest]   SKIP (empty title): {line}")
            continue

        # ── Fix 3: Draft flag ───────────────────────────────────────────
        # Events with no parseable date are kept as drafts instead of dropped.
        is_exam_keyword = any(k in title.lower() for k in _EXAM_KEYWORDS)
        is_draft = due_date == "TBD" and is_exam_keyword

        print(
            f"[Triton Ingest]   OK  title='{title}' type={raw_type} "
            f"date={due_date} weight={weight} draft={is_draft}"
        )

        events.append({
            "title":       title,
            "type":        raw_type,
            "due_date":    due_date,
            "weight":      weight,
            "description": description,
            "is_draft":    is_draft,
        })

    print(f"[Triton Ingest] Total parsed: {len(events)} events "
          f"({sum(1 for e in events if e['is_draft'])} drafts)\n")

    return events


# ── Multi-Pass Fuzzy Fallback ──────────────────────────────────────────────

# Loose date pattern used in the fuzzy scanner
_FUZZY_DATE_RE = re.compile(
    r"\b(\d{4}-\d{2}-\d{2}"                                    # ISO
    r"|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?"                    # M/D or M/D/YY
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"    # Month name
    r"[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{4})?)\b",
    re.IGNORECASE,
)


def fuzzy_exam_scan(text: str, course_id: str) -> list[dict]:
    """
    Regex-only fallback used when the LLM returns zero events.

    Scans every line of `text` for exam-keyword lines, extracts dates
    with a loose pattern, and returns draft events for user review.

    All events are marked  is_draft=False  if a date was found,
    or  is_draft=True  if the date is TBD, so the caller can decide
    how to handle them.
    """
    text = _clean_text(text)     # run the same cleaner first
    events: list[dict] = []
    seen_titles: set[str] = set()

    text = _expand_inline_dates(text)   # same expansion as the LLM path
    print(f"\n[Triton Fuzzy] Starting fallback scan for course={course_id}")

    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        low = s.lower()
        if not any(kw in low for kw in _EXAM_KEYWORDS):
            continue

        # Build a short title from the start of the line
        title = re.sub(r"\s+", " ", s[:70]).strip()
        if title in seen_titles:
            continue
        seen_titles.add(title)

        # Try to extract a date
        dm = _FUZZY_DATE_RE.search(s)
        due_date = _normalise_date(dm.group(0)) if dm else "TBD"

        # DOW correction if the line also mentions a weekday
        dow_match = re.search(
            r"\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?"
            r"|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b",
            low,
        )
        if dow_match and due_date != "TBD":
            target = _DOW_MAP.get(dow_match.group(1)[:3])
            if target is not None:
                corrected = _correct_date_to_dow(due_date, target)
                if corrected != due_date:
                    print(f"[Triton Fuzzy]   DOW fix: {due_date} → {corrected} ({dow_match.group(1)})")
                    due_date = corrected

        # Determine event type from keywords in the line
        ev_type = "EXAM"
        if "quiz" in low:
            ev_type = "QUIZ"

        is_draft = due_date == "TBD"
        print(f"[Triton Fuzzy]   Found: '{title}' type={ev_type} date={due_date} draft={is_draft}")

        events.append({
            "title":       title,
            "type":        ev_type,
            "due_date":    due_date,
            "weight":      0,
            "description": f"Auto-detected: {s[:120]}",
            "is_draft":    is_draft,
        })

    print(f"[Triton Fuzzy] Scan complete — {len(events)} candidate(s)\n")
    return events


# ── Syllabus Metadata Extraction ───────────────────────────────────────────

def extract_syllabus_metadata(pdf_text: str, course_name: str) -> dict:
    """
    Extract key dates and topics from a syllabus PDF text.
    Returns { events: [...], summary_spark: [...] }

    Uses a line-based format for reliable parsing:
      EVENT: <title> | <YYYY-MM-DD> | <type> | <topic1,topic2>
      SPARK: <bullet point>
    """
    # Use first 4000 chars — schedule is usually near the top
    truncated = pdf_text[:4000]

    prompt = f"""You are extracting structured data from a course syllabus for {course_name}.

SYLLABUS TEXT:
{truncated}

Extract ALL key academic dates and 3 summary bullets.

Use EXACTLY this format for each event (one per line):
EVENT: <event title> | <YYYY-MM-DD or "TBD"> | <midterm|final|homework_due|quiz|lecture> | <comma-separated topics>

Then write exactly 3 summary bullets:
SPARK: <short bullet about what this course covers>
SPARK: <short bullet about assessment structure>
SPARK: <short bullet about a key date or policy>

Only output EVENT and SPARK lines — no other text."""

    raw = _call(prompt)

    # Parse EVENT lines
    events = []
    for line in raw.splitlines():
        line = line.strip()
        if not line.upper().startswith("EVENT:"):
            continue
        parts = line[6:].split("|")
        if len(parts) < 3:
            continue
        title  = parts[0].strip()
        date   = parts[1].strip()
        etype  = parts[2].strip().lower()
        topics = [t.strip() for t in parts[3].split(",")] if len(parts) > 3 else []

        # Validate date format
        if not re.match(r"\d{4}-\d{2}-\d{2}", date):
            date = "TBD"

        # Normalise event type
        if etype not in ("midterm", "final", "homework_due", "quiz", "lecture"):
            if "mid" in etype:
                etype = "midterm"
            elif "final" in etype:
                etype = "final"
            elif "hw" in etype or "homework" in etype or "due" in etype or "pa" in etype:
                etype = "homework_due"
            elif "quiz" in etype:
                etype = "quiz"
            else:
                etype = "lecture"

        events.append({
            "title": title,
            "date": date,
            "type": etype,
            "topics_covered": [t.lower().replace(" ", "_") for t in topics if t],
        })

    sparks = _extract_all_labels(raw, "SPARK")[:3]
    if not sparks:
        sparks = ["Syllabus indexed — ask the TA about course structure."]

    return {"events": events, "summary_spark": sparks}
