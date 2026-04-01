"""
POST /api/chat — SSE streaming Socratic TA response.

Streams tokens back as Server-Sent Events:
  data: {"type": "text",    "delta": "..."}
  data: {"type": "sources", "sources": [...]}
  data: {"type": "done"}

Phase 2: Socratic Check-for-Understanding
  If the user's question touches a topic they have an *unresolved* error in,
  the TA pivots to address that error before answering the new question.
"""
from __future__ import annotations
import os
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from models.schemas import ChatRequest
from models.prompts import BASE_SYSTEM_PROMPT, SOCRATIC_PIVOT_BLOCK, get_course_name, get_course_context
from services.rag_service import retrieve_context
from services.llm_service import stream_chat

router = APIRouter()


# ── Error helpers ──────────────────────────────────────────────────────────

def _load_unresolved(course_id: str) -> list[dict]:
    path = os.path.join("data", "homework_errors", f"{course_id}_errors.json")
    if not os.path.isfile(path):
        return []
    with open(path) as f:
        data = json.load(f)
    return [
        e for e in data.get("errors", [])
        if e.get("status", "unresolved") == "unresolved"
    ]


def _build_error_context(unresolved: list[dict]) -> str:
    if not unresolved:
        return "No unresolved errors — great work so far!"
    lines = [
        f"- {e['topic']}/{e.get('subtopic','')}: {e.get('description','')} "
        f"(HW {e['homework_id']} #{e['problem']})"
        for e in unresolved
    ]
    return "\n".join(lines)


def _detect_overlap(message: str, unresolved: list[dict]) -> list[dict]:
    """
    Return errors whose topic keywords appear in the user's message.
    Minimum keyword length of 4 avoids false matches on short words.
    """
    msg_lower = message.lower()
    matched = []
    for err in unresolved:
        keywords = (
            err.get("topic", "").replace("_", " ").lower().split()
            + err.get("subtopic", "").replace("_", " ").lower().split()
        )
        if any(kw in msg_lower for kw in keywords if len(kw) >= 4):
            matched.append(err)
    return matched


# ── Event generator ────────────────────────────────────────────────────────

async def _event_generator(request: ChatRequest):
    # 1. Retrieve RAG context
    rag_chunks = retrieve_context(request.course_id, request.message, top_k=4)
    rag_context = (
        "\n\n---\n".join(
            f"[From {c['source']}, relevance {c['score']}]\n{c['text']}"
            for c in rag_chunks
        )
        if rag_chunks
        else "No course materials matched this question yet. Answer from general knowledge."
    )

    # 2. Check for Socratic pivot opportunity
    unresolved    = _load_unresolved(request.course_id)
    overlapping   = _detect_overlap(request.message, unresolved)
    error_context = _build_error_context(unresolved)

    pivot_block = ""
    if overlapping:
        pivot_lines = "\n".join(
            f"  • {e['topic'].replace('_',' ')} — \"{e.get('description','')}\" "
            f"(HW {e['homework_id']} #{e['problem']})"
            for e in overlapping[:2]   # surface at most 2
        )
        pivot_block = SOCRATIC_PIVOT_BLOCK.format(pivot_errors=pivot_lines)

    # 3. Build system prompt (works for any course_id, including user-added ones)
    system = BASE_SYSTEM_PROMPT.format(
        course_name    = get_course_name(request.course_id),
        course_context = get_course_context(request.course_id),
        rag_context    = rag_context,
        error_context  = error_context,
        pivot_block    = pivot_block,
    )

    # 4. Build message list
    messages = [{"role": m.role, "content": m.content} for m in request.conversation_history]
    messages.append({"role": "user", "content": request.message})

    # 5. Stream tokens
    for chunk in stream_chat(system, messages):
        text = chunk["message"]["content"]
        if text:
            yield f"data: {json.dumps({'type': 'text', 'delta': text})}\n\n"

    # 6. Source citations
    if rag_chunks:
        sources = [
            {"file": c["source"], "score": c["score"], "preview": c["text"][:100]}
            for c in rag_chunks
        ]
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    yield 'data: {"type": "done"}\n\n'


@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    return StreamingResponse(
        _event_generator(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
