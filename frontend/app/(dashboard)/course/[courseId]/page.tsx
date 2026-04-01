"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen, MessageCircle, FileUp, BarChart2, CalendarDays,
  ClipboardPaste, Loader2, CheckCircle2, AlertCircle, ArrowRight,
  Plus, PenLine, X,
} from "lucide-react";
import { useCourse } from "@/lib/CourseContext";
import { getCalendarEvents, getHomeworkErrors, ingestText, addCalendarEvent } from "@/lib/api";
import type { CalendarEvent, IngestResponse } from "@/lib/types";
import { EVENT_COLORS, EVENT_LABELS } from "@/lib/types";

// ── Quick-link cards ──────────────────────────────────────────────────────

const LINKS = [
  { href: "/chat",     label: "Chat with TA",  Icon: MessageCircle, desc: "Ask questions — Socratic hints, not answers." },
  { href: "/upload",   label: "Upload PDFs",   Icon: FileUp,        desc: "Index lecture notes, worksheets, past exams." },
  { href: "/progress", label: "My Progress",   Icon: BarChart2,     desc: "Review logged errors & recovery plans." },
  { href: "/calendar", label: "Calendar",      Icon: CalendarDays,  desc: "View all deadlines with Study Pulse." },
];

// ── Quick Add Modal ───────────────────────────────────────────────────────

function QuickAddModal({
  courseId,
  prefill,
  onSave,
  onClose,
}: {
  courseId:  string;
  prefill?:  Partial<CalendarEvent>;
  onSave:    (ev: CalendarEvent) => void;
  onClose:   () => void;
}) {
  const [title,  setTitle]  = useState(prefill?.title  ?? "");
  const [type,   setType]   = useState(prefill?.type   ?? "EXAM");
  const [date,   setDate]   = useState(prefill?.due_date && prefill.due_date !== "TBD" ? prefill.due_date : "");
  const [weight, setWeight] = useState(prefill?.weight ?? 0);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const handleSave = async () => {
    if (!title.trim()) { setErr("Title is required."); return; }
    setSaving(true);
    setErr("");
    try {
      const ev = await addCalendarEvent(courseId, {
        title: title.trim(),
        type,
        due_date: date || "TBD",
        weight,
        description: prefill?.description ?? "",
      });
      onSave(ev);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#182B49] border border-white/10 rounded-2xl p-5 w-[340px] shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-sm font-bold uppercase tracking-wider">
            {prefill ? "Confirm Draft Event" : "Add Event Manually"}
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60">
            <X size={14} />
          </button>
        </div>

        {prefill && (
          <p className="text-[11px] text-amber-400/80 mb-3 leading-relaxed">
            The AI found this event but couldn&apos;t confirm the date. Set it below to save it to your calendar.
          </p>
        )}

        <div className="space-y-2.5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
              placeholder:text-white/25 focus:outline-none focus:border-[#C69214]/50"
          />
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
            >
              {["EXAM","ASSIGNMENT","QUIZ","LECTURE","OFFICE_HOURS"].map((t) => (
                <option key={t} value={t} className="bg-[#182B49]">{t}</option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                focus:outline-none focus:border-[#C69214]/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-white/35 text-xs shrink-0">Grade %</label>
            <input
              type="number" min={0} max={100} value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
            />
          </div>
        </div>

        {err && <p className="text-red-400/80 text-[11px] mt-2">{err}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-white/40 text-xs font-medium border border-white/10 hover:border-white/25 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 py-2 rounded-lg text-[#0F1D30] text-xs font-bold uppercase tracking-wider disabled:opacity-40 transition-opacity"
            style={{ background: "linear-gradient(45deg,#C69214,#E8B84B)" }}
          >
            {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Draft Review Banner ───────────────────────────────────────────────────

function DraftReviewBanner({
  drafts,
  courseId,
  onConfirm,
  onDismiss,
}: {
  drafts:    CalendarEvent[];
  courseId:  string;
  onConfirm: (ev: CalendarEvent) => void;
  onDismiss: (id: string) => void;
}) {
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  return (
    <>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <PenLine size={13} className="text-amber-400" />
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">
            {drafts.length} Draft{drafts.length !== 1 ? "s" : ""} Need a Date
          </span>
          <span className="text-white/25 text-[10px]">— the AI found these but couldn&apos;t confirm the date</span>
        </div>
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="flex items-center justify-between gap-3 bg-white/3 rounded-lg px-3 py-2 border border-white/8"
          >
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-xs font-medium truncate">{draft.title}</p>
              <p className="text-[10px] text-amber-400/60 mt-0.5">Date: TBD</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => setEditing(draft)}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold text-[#0F1D30] uppercase tracking-wide"
                style={{ background: "linear-gradient(45deg,#C69214,#E8B84B)" }}
              >
                Set Date
              </button>
              <button
                onClick={() => onDismiss(draft.id)}
                className="px-2 py-1 rounded-md text-[10px] text-white/30 hover:text-white/60 border border-white/10"
              >
                Skip
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <QuickAddModal
          courseId={courseId}
          prefill={editing}
          onSave={(ev) => { onConfirm(ev); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// ── Smart Ingest panel ─────────────────────────────────────────────────────

function IngestPanel({
  courseId,
  onNewEvents,
  onDraftEvents,
}: {
  courseId:      string;
  onNewEvents:   (events: CalendarEvent[]) => void;
  onDraftEvents: (drafts: CalendarEvent[]) => void;
}) {
  const [text,   setText]   = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg,    setMsg]    = useState("");

  const handleIngest = async () => {
    if (!text.trim()) return;
    setStatus("loading");
    setMsg("");
    try {
      const res: IngestResponse = await ingestText(text, courseId, "scraped");
      const drafts = res.draft_events ?? [];

      if (res.events_extracted > 0 || drafts.length > 0) {
        setStatus("ok");
        const parts = [];
        if (res.events_extracted > 0)
          parts.push(`${res.events_extracted} event${res.events_extracted !== 1 ? "s" : ""} saved`);
        if (drafts.length > 0)
          parts.push(`${drafts.length} draft${drafts.length !== 1 ? "s" : ""} need a date`);
        setMsg(parts.join(" · "));
        if (res.events.length)  onNewEvents(res.events);
        if (drafts.length)      onDraftEvents(drafts);
      } else {
        setStatus("ok");
        setMsg("No structured events found — try pasting a section with dates.");
      }
      setText("");
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "Ingest failed");
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardPaste size={15} className="text-[#C69214]" />
        <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Smart Ingest</span>
        <span className="text-white/25 text-[10px] ml-1">— paste Canvas text or use the Chrome extension</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setStatus("idle"); }}
        placeholder={
          "Paste your syllabus or Canvas page text here…\n\n" +
          "The AI will extract deadlines, exams, and assignments\n" +
          "and add them to your Triton Calendar automatically."
        }
        rows={6}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white/80
          text-xs placeholder:text-white/20 focus:outline-none focus:border-[#C69214]/40 resize-none font-mono leading-relaxed"
      />

      <div className="flex items-center justify-between mt-2.5 gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {status === "ok" && (
            <><CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
            <span className="text-emerald-400/80 text-[11px] truncate">{msg}</span></>
          )}
          {status === "error" && (
            <><AlertCircle size={13} className="text-red-400 shrink-0" />
            <span className="text-red-400/80 text-[11px] truncate">{msg}</span></>
          )}
        </div>
        <button
          onClick={handleIngest}
          disabled={!text.trim() || status === "loading"}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold
            uppercase tracking-wider text-[#0F1D30] disabled:opacity-40 transition-opacity"
          style={{ background: "linear-gradient(45deg,#C69214,#E8B84B)" }}
        >
          {status === "loading" ? <Loader2 size={12} className="animate-spin" /> : "Extract Events"}
        </button>
      </div>
    </div>
  );
}

// ── Upcoming events strip ──────────────────────────────────────────────────

function UpcomingEvents({
  events,
  courseId,
  onManualAdd,
}: {
  events:       CalendarEvent[];
  courseId:     string;
  onManualAdd:  (ev: CalendarEvent) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  const upcoming = events
    .filter((e) => e.due_date && e.due_date !== "TBD" && !e.completed)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  if (upcoming.length === 0) {
    return (
      <>
        {/* Fix 4: "Add Manually" fallback when no events exist */}
        <div className="flex flex-col items-center gap-3 py-5">
          <p className="text-white/20 text-xs text-center">
            No upcoming events yet.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/15
              hover:border-[#C69214]/40 text-white/35 hover:text-[#E8B84B] text-[11px] transition-colors"
          >
            <Plus size={12} /> Add Manually
          </button>
        </div>

        {showAdd && (
          <QuickAddModal
            courseId={courseId}
            onSave={(ev) => { onManualAdd(ev); setShowAdd(false); }}
            onClose={() => setShowAdd(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        {upcoming.map((ev) => {
          const color     = EVENT_COLORS[ev.type] ?? "#888";
          const daysUntil = Math.ceil((new Date(ev.due_date).getTime() - Date.now()) / 86400000);
          return (
            <div
              key={ev.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ background: color + "0D", borderLeft: `2px solid ${color}` }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-xs font-medium truncate">{ev.title}</p>
                <p className="text-[10px] mt-0.5" style={{ color }}>
                  {EVENT_LABELS[ev.type]}
                  {ev.weight > 0 && <span className="text-white/30 ml-1">· {ev.weight}%</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white/50 text-[10px]">{ev.due_date}</p>
                <p
                  className="text-[10px] font-semibold mt-0.5"
                  style={{ color: daysUntil <= 7 ? "#EF4444" : daysUntil <= 14 ? "#C69214" : "#ffffff44" }}
                >
                  {daysUntil <= 0 ? "Today" : `${daysUntil}d`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Always show add button below the list too */}
      <button
        onClick={() => setShowAdd(true)}
        className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg
          border border-dashed border-white/10 hover:border-[#C69214]/30
          text-white/20 hover:text-[#E8B84B] text-[10px] transition-colors"
      >
        <Plus size={11} /> Add manually
      </button>

      {showAdd && (
        <QuickAddModal
          courseId={courseId}
          onSave={(ev) => { onManualAdd(ev); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function CoursePage() {
  const params      = useParams();
  const router      = useRouter();
  const urlCourseId = typeof params.courseId === "string" ? params.courseId : "";

  const { courses, triggerRefresh } = useCourse();
  const course = courses.find((c) => c.id === urlCourseId);

  const [events,        setEvents]        = useState<CalendarEvent[]>([]);
  const [draftEvents,   setDraftEvents]   = useState<CalendarEvent[]>([]);
  const [errorCount,    setErrorCount]    = useState(0);
  const [eventsLoading, setEventsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!urlCourseId) return;
    setEventsLoading(true);
    try {
      const [calRes, errRes] = await Promise.allSettled([
        getCalendarEvents(urlCourseId),
        getHomeworkErrors(urlCourseId),
      ]);
      if (calRes.status === "fulfilled") setEvents(calRes.value.events);
      if (errRes.status === "fulfilled") {
        setErrorCount(errRes.value.errors.filter((e) => e.status === "unresolved").length);
      }
    } finally {
      setEventsLoading(false);
    }
  }, [urlCourseId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Event list mutations ─────────────────────────────────────────────
  const handleNewEvents = (evs: CalendarEvent[]) => {
    setEvents((prev) => [...prev, ...evs]);
    triggerRefresh();
  };
  const handleDraftEvents = (evs: CalendarEvent[]) => setDraftEvents((prev) => [...prev, ...evs]);

  const handleDraftConfirm = (ev: CalendarEvent) => {
    setDraftEvents((prev) => prev.filter((d) => d.title !== ev.title));
    setEvents((prev) => [...prev, ev]);
    triggerRefresh();
  };

  const handleDraftDismiss = (id: string) =>
    setDraftEvents((prev) => prev.filter((d) => d.id !== id));

  const handleManualAdd = (ev: CalendarEvent) => {
    setEvents((prev) => [...prev, ev]);
    triggerRefresh();
  };

  // Unknown course guard
  if (!course && courses.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0F1D30] gap-4">
        <p className="text-white/40 text-sm">
          Course not found: <code className="text-[#C69214]">{urlCourseId}</code>
        </p>
        <button onClick={() => router.push("/home")} className="text-[#E8B84B] text-xs underline underline-offset-2">
          Back to Home
        </button>
      </div>
    );
  }

  const upcomingCount = events.filter((e) => {
    if (!e.due_date || e.due_date === "TBD" || e.completed) return false;
    return (new Date(e.due_date).getTime() - Date.now()) / 86400000 <= 14;
  }).length;

  return (
    <div className="flex flex-col h-full bg-[#0F1D30] overflow-y-auto">

      {/* Hero header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={16} className="text-[#C69214]" />
              <span className="text-[#C69214]/70 text-[11px] uppercase tracking-widest font-semibold">Course Hub</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {course?.code ?? urlCourseId.toUpperCase()}
            </h1>
            {course?.name && <p className="text-white/40 text-sm mt-0.5">{course.name}</p>}
          </div>

          <div className="flex gap-3 shrink-0 mt-1">
            {[
              { label: "Events",     value: events.length,   color: "rgba(255,255,255,0.7)" },
              { label: "Due in 14d", value: upcomingCount,   color: upcomingCount > 0 ? "#C69214" : "rgba(255,255,255,0.3)" },
              { label: "Unresolved", value: errorCount,      color: errorCount > 0 ? "#EF4444" : "rgba(255,255,255,0.3)" },
            ].map(({ label, value, color }, i) => (
              <div key={label} className="flex items-center gap-3">
                {i > 0 && <div className="w-px h-6 bg-white/10" />}
                <div className="text-center">
                  <p className="text-lg font-bold leading-none" style={{ color }}>
                    {eventsLoading ? "—" : value}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-5 grid grid-cols-1 lg:grid-cols-2 gap-5 content-start">

        {/* Smart Ingest */}
        <div className="lg:col-span-2">
          <IngestPanel
            courseId={urlCourseId}
            onNewEvents={handleNewEvents}
            onDraftEvents={handleDraftEvents}
          />
        </div>

        {/* Draft review banner — spans full width when drafts exist */}
        {draftEvents.length > 0 && (
          <div className="lg:col-span-2">
            <DraftReviewBanner
              drafts={draftEvents}
              courseId={urlCourseId}
              onConfirm={handleDraftConfirm}
              onDismiss={handleDraftDismiss}
            />
          </div>
        )}

        {/* Upcoming events */}
        <div className="rounded-xl border border-white/10 bg-white/3 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-[#C69214]" />
              <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Upcoming</span>
            </div>
            <button
              onClick={() => router.push("/calendar")}
              className="flex items-center gap-1 text-[10px] text-white/25 hover:text-[#E8B84B] transition-colors"
            >
              Full calendar <ArrowRight size={11} />
            </button>
          </div>

          {eventsLoading
            ? <div className="h-20 flex items-center justify-center"><Loader2 size={16} className="text-white/20 animate-spin" /></div>
            : <UpcomingEvents events={events} courseId={urlCourseId} onManualAdd={handleManualAdd} />
          }
        </div>

        {/* Quick links */}
        <div className="rounded-xl border border-white/10 bg-white/3 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Quick Links</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {LINKS.map(({ href, label, Icon, desc }) => (
              <button
                key={href}
                onClick={() => router.push(href)}
                className="flex flex-col items-start gap-1.5 p-3 rounded-lg border border-white/8
                  bg-white/3 hover:bg-white/6 hover:border-[#C69214]/30 transition-all text-left group"
              >
                <Icon size={16} className="text-[#C69214]/70 group-hover:text-[#C69214] transition-colors" />
                <span className="text-white/70 text-xs font-medium group-hover:text-white/90 transition-colors">{label}</span>
                <span className="text-white/25 text-[10px] leading-relaxed">{desc}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
