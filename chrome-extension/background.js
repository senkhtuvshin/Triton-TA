/**
 * Triton Smart-Scrape — Background Service Worker
 *
 * Handles API calls to the local FastAPI backend so the popup
 * doesn't run into CORS restrictions from a non-chrome-extension origin.
 */

const DEFAULT_API = "http://localhost:8000";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SEND_TO_AGENT") {
    handleSendToAgent(msg.payload).then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: String(err) });
    });
    return true;   // keep message channel open for async response
  }

  if (msg.type === "FETCH_PDF") {
    handleFetchPdf(msg.payload).then(sendResponse).catch((err) => {
      sendResponse({ ok: false, error: String(err) });
    });
    return true;
  }
});

// ── Send raw text to /api/calendar/ingest ─────────────────────────────

async function handleSendToAgent({ text, courseId, source, googleDocId, apiBase }) {
  const base = apiBase || DEFAULT_API;

  // Get user ID from storage (set by the popup if available)
  const { userId } = await chrome.storage.local.get("userId");

  const headers = { "Content-Type": "application/json" };
  if (userId) headers["X-User-ID"] = userId;

  const body = {
    text:          text || "",
    course_id:     courseId,
    source:        source || "scraped",
    google_doc_id: googleDocId || null,
  };

  const res = await fetch(`${base}/api/calendar/ingest`, {
    method:  "POST",
    headers,
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(detail.detail || `HTTP ${res.status}`);
  }

  return { ok: true, data: await res.json() };
}

// ── Fetch a PDF URL and send its contents (base64) to the popup ──────

async function handleFetchPdf({ url }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch PDF: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary   = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return { ok: true, base64: btoa(binary), url };
}
