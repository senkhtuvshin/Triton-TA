/**
 * Triton Smart-Scrape — Popup Logic
 *
 * Flow:
 *   1. On open: ask content script for scrape data (or load from storage)
 *   2. Display summary: char count, PDF links, Google Doc IDs
 *   3. On "Send to Agent": call background.js → backend /api/calendar/ingest
 *   4. Show extracted event count and result
 */

// ── DOM refs ───────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

const elDot          = $("status-dot");
const elPageTitle    = $("page-title");
const elPageUrl      = $("page-url");
const elScrapeSummary= $("scrape-summary");
const elCharCount    = $("char-count");
const elPdfCount     = $("pdf-count");
const elGdocCount    = $("gdoc-count");
const elGdocSection  = $("gdoc-section");
const elGdocList     = $("gdoc-list");
const elPdfSection   = $("pdf-section");
const elPdfList      = $("pdf-list");
const elActionSection= $("action-section");
const elNotCanvas    = $("not-canvas");
const elSendBtn      = $("send-btn");
const elSendLabel    = $("send-label");
const elSendSpinner  = $("send-spinner");
const elSendStatus   = $("send-status");
const elResultSection= $("result-section");
const elResultBody   = $("result-body");
const elCourseInput  = $("course-input");
const elApiInput     = $("api-input");

// ── State ──────────────────────────────────────────────────────────────────

let scrapeData = null;

// ── Restore saved settings ─────────────────────────────────────────────────

chrome.storage.local.get(["savedCourseId", "savedApiBase"], (res) => {
  if (res.savedCourseId) elCourseInput.value = res.savedCourseId;
  if (res.savedApiBase)  elApiInput.value    = res.savedApiBase;
});

// Persist on change
elCourseInput.addEventListener("change", () =>
  chrome.storage.local.set({ savedCourseId: elCourseInput.value.trim() })
);
elApiInput.addEventListener("change", () =>
  chrome.storage.local.set({ savedApiBase: elApiInput.value.trim() })
);

// ── Ask content script for current scrape ─────────────────────────────────

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab) return;

  elPageTitle.textContent = tab.title || "—";
  elPageUrl.textContent   = tab.url   || "—";

  // canvas.ucsd.edu is NOT an instructure.com subdomain — check it explicitly.
  const isCanvas =
    tab.url?.includes("canvas.ucsd.edu") ||
    tab.url?.includes("instructure.com") ||
    tab.url?.includes("canvas.com");

  if (!isCanvas) {
    setStatus("idle");
    elNotCanvas.style.display = "block";
    return;
  }

  setStatus("canvas");
  elNotCanvas.style.display = "none";

  // ── Always show the action section and summary row on any Canvas page ──
  // The button visibility must NOT depend on whether scrape found content.
  elActionSection.style.display = "block";
  elScrapeSummary.style.display = "block";
  setScrapeStatus("Ready to Sync");   // default until scrape arrives
  updateSendButton();

  // Try messaging the content script first
  chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_NOW" }, (res) => {
    if (chrome.runtime.lastError || !res) {
      // Fall back to last stored scrape
      chrome.storage.local.get(["lastScrape"], (stored) => {
        if (stored.lastScrape) displayScrape(stored.lastScrape);
        // If nothing in storage either, leave "Ready to Sync" — button stays visible.
      });
      return;
    }
    displayScrape(res);
  });

  // Also check for pending Google Doc IDs
  chrome.storage.local.get(["pendingGDocs"], (res) => {
    const ids = res.pendingGDocs || [];
    if (ids.length > 0) renderGdocList(ids);
  });
});

// ── Display scrape results ─────────────────────────────────────────────────

function displayScrape(data) {
  scrapeData = data;

  // ── Update summary badges ────────────────────────────────────────────
  // Always update — never hide the action section or return early.
  elScrapeSummary.style.display = "block";

  const charLen = data?.text?.length || 0;
  if (charLen >= 200) {
    setScrapeStatus(`${charLen.toLocaleString()} chars captured`);
  } else {
    // Scrape ran but found little or nothing — still show the button,
    // just reflect the low character count so the user knows.
    setScrapeStatus(charLen > 0 ? `${charLen} chars (low — try scrolling)` : "Ready to Sync");
  }

  elPdfCount.textContent  = `${data?.pdfLinks?.length || 0} PDFs`;
  elGdocCount.textContent = `${data?.gdocIds?.length  || 0} Google Docs`;

  // Google Docs list
  if (data?.gdocIds?.length) {
    elGdocSection.style.display = "block";
    renderGdocList(data.gdocIds);
  }

  // PDF list
  if (data?.pdfLinks?.length) {
    elPdfSection.style.display = "block";
    elPdfList.innerHTML = data.pdfLinks.slice(0, 6).map((p) => `
      <li>
        <span class="item-name" title="${p.url}">${p.text}</span>
        <span class="item-badge">PDF</span>
      </li>
    `).join("");
  }

  // Note: elActionSection visibility is already set in the Canvas detection
  // block — we do NOT touch it here so the button always stays visible.
  updateSendButton();
}

function renderGdocList(ids) {
  elGdocSection.style.display = "block";
  elGdocList.innerHTML = ids.map((id) => `
    <li>
      <span class="item-name" title="${id}">Doc: ${id.slice(0, 20)}…</span>
      <span class="item-badge">GDoc</span>
    </li>
  `).join("");
}

function updateSendButton() {
  // Only require a course ID to be entered — do NOT gate on scrapeData.
  // If scrapeData is empty when the user clicks, we show an alert instead.
  const hasCourse = elCourseInput.value.trim().length > 0;
  elSendBtn.disabled = !hasCourse;
}

elCourseInput.addEventListener("input", updateSendButton);

// ── Send to Agent ─────────────────────────────────────────────────────────

elSendBtn.addEventListener("click", async () => {
  const courseId = elCourseInput.value.trim();
  const apiBase  = elApiInput.value.trim() || "http://localhost:8000";

  if (!courseId) return;

  // Save settings
  chrome.storage.local.set({ savedCourseId: courseId, savedApiBase: apiBase });

  setSending(true);
  elSendStatus.style.display = "none";
  elResultSection.style.display = "none";

  // Collect pending Google Doc IDs
  const pendingGDocs = await new Promise((resolve) =>
    chrome.storage.local.get(["pendingGDocs"], (r) => resolve(r.pendingGDocs || []))
  );

  // ── Guard: nothing to send ─────────────────────────────────────────
  const hasPageText = scrapeData?.hasContent || (scrapeData?.text?.length >= 200);
  const hasGDocs    = pendingGDocs.length > 0;

  if (!hasPageText && !hasGDocs) {
    alert(
      "No text captured yet.\n\n" +
      "Try:\n" +
      "• Scrolling down so Canvas fully loads the syllabus\n" +
      "• Reloading the page, then reopening this popup\n\n" +
      "Check DevTools → Console and filter by [Triton] to see what was scraped."
    );
    setSending(false);
    return;
  }

  // Send main page text
  const results = [];
  let totalEvents = 0;

  try {
    if (hasPageText) {
      const res = await sendToBackground({
        text:     scrapeData.text,
        courseId,
        source:   "scraped",
        apiBase,
      });
      if (res.ok) {
        totalEvents += res.data.events_extracted;
        results.push(`Page text → <strong>${res.data.events_extracted}</strong> events`);
      }
    }

    // Send each pending Google Doc
    for (const docId of pendingGDocs) {
      const res = await sendToBackground({
        text:        "",
        courseId,
        source:      "google_doc",
        googleDocId: docId,
        apiBase,
      });
      if (res.ok) {
        totalEvents += res.data.events_extracted;
        results.push(`Google Doc ${docId.slice(0, 8)}… → <strong>${res.data.events_extracted}</strong> events`);
      }
    }

    // Clear pending docs
    chrome.storage.local.set({ pendingGDocs: [] });

    showStatus("ok", `✓ Extracted ${totalEvents} event${totalEvents !== 1 ? "s" : ""} for ${courseId}`);
    setStatus("success");

    if (results.length) {
      elResultSection.style.display = "block";
      elResultBody.innerHTML = results.join("<br>");
    }
  } catch (err) {
    showStatus("error", `✗ ${err.message}`);
  } finally {
    setSending(false);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────

function sendToBackground(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "SEND_TO_AGENT", payload }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!res?.ok) {
        reject(new Error(res?.error || "Unknown error"));
      } else {
        resolve(res);
      }
    });
  });
}

function setStatus(state) {
  elDot.className = "dot dot-" + state;
  elDot.title = {
    idle:    "Not on a Canvas page",
    canvas:  "Canvas page detected",
    success: "Events extracted successfully",
    error:   "Error occurred",
  }[state] || "";
}

function setSending(sending) {
  elSendBtn.disabled  = sending;
  elSendLabel.style.display  = sending ? "none"  : "inline";
  elSendSpinner.style.display = sending ? "inline-block" : "none";
}

function showStatus(type, msg) {
  elSendStatus.style.display = "block";
  elSendStatus.className = `status-msg ${type}`;
  elSendStatus.textContent = msg;
}

/**
 * Update the char-count badge in the summary row.
 * Falls back to "Ready to Sync" when scrapeData is null/empty.
 */
function setScrapeStatus(text) {
  elCharCount.textContent = text ?? "Ready to Sync";
}
