/**
 * Triton Smart-Scrape — Content Script
 * Runs on Canvas / Instructure pages.
 *
 * Three scrape targets:
 *   A. Canvas native text  (aggressive multi-selector + nuclear fallback)
 *   B. Google Doc links    (inject "Sync Google Doc" button)
 *   C. PDF link harvester  (collect all .pdf hrefs on the page)
 *
 * Open DevTools → Console and filter by "[Triton]" to see live debug output.
 */

(function () {
  "use strict";

  const TAG = "[Triton Smart-Scrape]";

  // ── Target A: Canvas native text ──────────────────────────────────────
  //
  // Ordered from most-specific to least-specific.
  // Each selector is logged individually so you can see exactly which one hit.

  // ── Priority selectors — TWO TIERS, always combined ─────────────────
  //
  // Tier 1 TABLE: the weekly assignment rows (homework due dates, quiz dates).
  //   Canvas renders these as a structured table — great for deadlines.
  //
  // Tier 2 BODY:  the prose syllabus description (exam schedule paragraph,
  //   grading policy, etc.).  This is where "scheduled for Friday 4/24,
  //   Friday 5/15, and Saturday 6/6" lives.
  //
  // IMPORTANT: we always merge BOTH tiers before returning.
  // A fast-path that returns on table-only would miss the exam paragraph.

  const TABLE_SELECTORS = [
    "#syllabus_summary",              // condensed syllabus table (assignment rows)
    ".syllabus_assignment_row",       // individual assignment rows
    "#syllabusContainer table",       // any table inside syllabusContainer
    ".ic-Table",                      // Canvas standard table class
    "table.ic-Table--condensed",      // condensed variant
  ];

  const BODY_SELECTORS = [
    "#syllabus_body",                 // prose syllabus description (exam schedule lives here)
    ".student-version",               // student-view wrapper
    "#wiki_page_show .show-content",  // wiki page rich-text body
    ".show-content.user_content",     // alternate body selector
  ];

  const MIN_PRIORITY_CHARS = 300;    // minimum for the combined result to be used

  function extractPriorityText() {
    const seen       = new Set();
    const tableParts = [];
    const bodyParts  = [];

    for (const sel of TABLE_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const t = el.innerText?.trim() ?? "";
        if (t.length >= 50) {
          tableParts.push(t);
          console.log(`${TAG} [Table] "${sel}" → ${t.length} chars`);
        }
      });
    }

    for (const sel of BODY_SELECTORS) {
      document.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const t = el.innerText?.trim() ?? "";
        if (t.length >= 50) {
          bodyParts.push(t);
          console.log(`${TAG} [Body]  "${sel}" → ${t.length} chars`);
        }
      });
    }

    // Always combine — table has homework dates, body has exam paragraph.
    // Label each section so the backend parser can orient itself.
    const sections = [];
    if (tableParts.length > 0)
      sections.push("[SYLLABUS TABLE — assignments & deadlines]\n" + tableParts.join("\n\n"));
    if (bodyParts.length > 0)
      sections.push("[SYLLABUS BODY — course description & exam schedule]\n" + bodyParts.join("\n\n"));

    const combined = sections.join("\n\n---\n\n");
    console.log(
      `${TAG} Priority extraction: table=${tableParts.length} block(s), ` +
      `body=${bodyParts.length} block(s), total=${combined.length} chars`
    );
    return combined;
  }

  const TEXT_SELECTORS = [
    // ── Explicitly requested ──────────────────────────────────────────
    "#wiki_page_show",          // full wiki page shell
    "#wiki_page_show .show-content",
    "#syllabus_body",           // the main syllabus table / body
    ".student-version",         // Canvas student-view wrapper

    // ── Standard content areas ────────────────────────────────────────
    ".user_content",            // most Canvas rich-content iframes embed here
    "#content .user_content",
    "#main-content .user_content",
    ".assignment .description",
    ".assignment_description",
    ".description.user_content",

    // ── Module / item views ───────────────────────────────────────────
    ".ig-row",                  // module item rows
    ".context_module_item",
    "#context_modules",

    // ── Syllabus table rows ───────────────────────────────────────────
    "#syllabusContainer",
    "#syllabus",
    ".syllabus",
    "[id*='syllabus']",
    "[class*='syllabus']",

    // ── Page / discussion bodies ──────────────────────────────────────
    "#page-wrapper",
    ".show-content",
    ".entry-content",
    ".discussion-entry-content",
    "#main",
    "main[role='main']",
    "#content",
  ];

  // Minimum characters for a block to be worth including
  const MIN_BLOCK_CHARS = 80;

  // Total characters needed to consider the scrape a success
  const MIN_TOTAL_CHARS = 200;

  function extractCanvasText() {
    // ── Fast path: targeted table + body extraction ───────────────────────
    // Grabs BOTH the assignment table (homework) AND the prose body (exams).
    // Only falls through to the full DOM walk if both tiers return nothing.
    const priorityText = extractPriorityText();
    if (priorityText.length >= MIN_PRIORITY_CHARS) {
      const header =
        `PAGE TITLE: ${document.title}\nURL: ${window.location.href}\n` +
        `[SOURCE: Triton Priority Syllabus Extraction]\n\n`;
      const result = header + priorityText;
      console.log(
        `${TAG} Priority path succeeded — ${priorityText.length} chars ` +
        `(table + body combined, skipping full DOM walk)`
      );
      console.log(`${TAG} Preview:\n"${result.slice(0, 400)}…"`);
      return result;
    }

    // ── Full DOM walk (fallback) ───────────────────────────────────────────
    console.log(`${TAG} Priority selectors returned ${priorityText.length} chars — ` +
                `falling back to full DOM walk (${TEXT_SELECTORS.length} selectors)`);

    const seen  = new Set();   // deduplicate by element reference
    const parts = [];

    for (const sel of TEXT_SELECTORS) {
      let hits = 0;
      document.querySelectorAll(sel).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);

        const t = el.innerText?.trim() ?? "";
        if (t.length < MIN_BLOCK_CHARS) return;

        hits++;
        parts.push(t);
      });

      if (hits > 0) {
        console.log(`${TAG}   ✓ "${sel}" → ${hits} element(s) found`);
      }
    }

    // ── Nuclear fallback: grab any large <div>/<section>/<article> ───────
    // If named selectors found nothing, walk the DOM looking for any block
    // element with a large text payload (likely the syllabus regardless of
    // what class Canvas happened to use on this particular instance).

    if (parts.length === 0) {
      console.warn(`${TAG} Named selectors found nothing — running nuclear fallback`);
      const candidates = document.querySelectorAll(
        "div, section, article, table, tbody"
      );

      let fallbackHits = 0;
      candidates.forEach((el) => {
        if (seen.has(el)) return;
        const t = el.innerText?.trim() ?? "";
        // Only take top-level large blocks; skip deeply nested duplicates
        if (t.length < 500) return;
        // Avoid grabbing nav bars, headers, etc.
        const role = el.getAttribute("role") ?? "";
        const tag  = el.tagName.toLowerCase();
        if (["navigation", "banner", "toolbar", "search"].includes(role)) return;
        if (el.closest("nav, header, footer, [role='navigation']")) return;

        seen.add(el);
        fallbackHits++;
        parts.push(t);
      });

      if (fallbackHits > 0) {
        console.log(`${TAG}   ↳ Nuclear fallback captured ${fallbackHits} large block(s)`);
      } else {
        console.error(`${TAG}   ✗ Nuclear fallback also found nothing — page may still be loading`);
      }
    }

    // Prepend page title for context
    const title = document.title;
    if (title) parts.unshift(`PAGE TITLE: ${title}\nURL: ${window.location.href}`);

    const combined = parts.join("\n\n---\n\n");

    console.log(
      `${TAG} Extraction complete — ${parts.length} block(s), ` +
      `${combined.length.toLocaleString()} total chars, ` +
      `hasContent=${combined.length >= MIN_TOTAL_CHARS}`
    );

    if (combined.length >= MIN_TOTAL_CHARS) {
      // Show first 300 chars so you can verify the right text was captured
      console.log(`${TAG} Preview:\n"${combined.slice(0, 300)}…"`);
    }

    return combined;
  }

  // ── Target B: Google Doc Bridge ───────────────────────────────────────

  const GDOC_REGEX = /https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;

  function findGoogleDocIds() {
    const ids = new Set();
    document.querySelectorAll("a[href]").forEach((a) => {
      const m = a.href.match(GDOC_REGEX);
      if (m) ids.add(m[1]);
    });
    if (ids.size > 0) console.log(`${TAG} Google Doc IDs found:`, [...ids]);
    return [...ids];
  }

  function injectGDocButtons() {
    document.querySelectorAll("a[href]").forEach((a) => {
      const m = a.href.match(GDOC_REGEX);
      if (!m) return;
      const docId = m[1];
      if (a.dataset.tritonInjected) return;
      a.dataset.tritonInjected = "1";

      const btn = document.createElement("button");
      btn.textContent = "⬇ Sync to Triton";
      btn.title = "Send this Google Doc to UCSD Course Agent for event extraction";
      btn.style.cssText = `
        display: inline-block;
        margin-left: 8px;
        padding: 2px 8px;
        border-radius: 12px;
        background: linear-gradient(45deg, #C69214, #E8B84B);
        color: #0F1D30;
        font-size: 11px;
        font-weight: 700;
        border: none;
        cursor: pointer;
        letter-spacing: 0.05em;
        vertical-align: middle;
      `;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        chrome.storage.local.get(["pendingGDocs"], (res) => {
          const pending = res.pendingGDocs || [];
          if (!pending.includes(docId)) pending.push(docId);
          chrome.storage.local.set({ pendingGDocs: pending });
          btn.textContent = "✓ Queued";
          btn.style.background = "#10B981";
          console.log(`${TAG} Google Doc queued: ${docId}`);
        });
      });
      a.insertAdjacentElement("afterend", btn);
    });
  }

  // ── Target C: PDF link harvester ──────────────────────────────────────

  function findPdfLinks() {
    const links = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      if (a.href.toLowerCase().includes(".pdf")) {
        links.push({
          url:  a.href,
          text: a.innerText?.trim() || a.href.split("/").pop() || "PDF",
        });
      }
    });
    if (links.length > 0) {
      console.log(`${TAG} PDF links found: ${links.length}`, links.map((l) => l.text));
    }
    return links;
  }

  // ── Scrape & broadcast to extension ───────────────────────────────────

  function runScrape() {
    console.groupCollapsed(`${TAG} runScrape() @ ${new Date().toLocaleTimeString()}`);

    const text     = extractCanvasText();
    const gdocIds  = findGoogleDocIds();
    const pdfLinks = findPdfLinks();
    const pageUrl  = window.location.href;

    const courseMatch    = pageUrl.match(/\/courses\/(\d+)\//);
    const canvasCourseId = courseMatch ? courseMatch[1] : null;
    if (canvasCourseId) console.log(`${TAG} Canvas course ID from URL: ${canvasCourseId}`);

    const result = {
      text,
      gdocIds,
      pdfLinks,
      pageUrl,
      pageTitle:     document.title,
      canvasCourseId,
      scrapedAt:     new Date().toISOString(),
      hasContent:    text.length >= MIN_TOTAL_CHARS,
    };

    console.log(
      `${TAG} Result summary — hasContent:${result.hasContent} | ` +
      `chars:${text.length} | pdfs:${pdfLinks.length} | gdocs:${gdocIds.length}`
    );
    console.groupEnd();

    chrome.storage.local.set({ lastScrape: result });
    return result;
  }

  // ── Boot ──────────────────────────────────────────────────────────────

  console.log(`${TAG} Content script loaded on ${window.location.href}`);
  injectGDocButtons();
  runScrape();

  // Re-scrape when Canvas finishes dynamic navigation, but debounce heavily
  // so we don't spam the console or storage on every tiny DOM twitch.
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      injectGDocButtons();
      runScrape();
    }, 1500);   // wait 1.5 s after the last mutation batch
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Popup can trigger an immediate fresh scrape at any time
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "SCRAPE_NOW") {
      console.log(`${TAG} Manual SCRAPE_NOW triggered from popup`);
      sendResponse(runScrape());
    }
  });
})();
