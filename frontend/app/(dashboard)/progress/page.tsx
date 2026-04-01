"use client";
import { useState, useEffect, useRef } from "react";
import { useCourse } from "@/lib/CourseContext";
import { COURSE_NAMES, STATUS_CYCLE, STATUS_LABELS } from "@/lib/types";
import type { HomeworkError, ErrorStatus, DeepDiveResponse } from "@/lib/types";
import {
  getHomeworkErrors,
  logHomeworkError,
  updateErrorStatus,
  getDeepDive,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Sparkles, ChevronDown, ChevronUp, BookOpen, Zap, FileSearch, ImagePlus, X } from "lucide-react";

// ── Status badge config ──────────────────────────────────────────────────

const STATUS_STYLE: Record<ErrorStatus, string> = {
  unresolved: "bg-red-900/30 text-red-400 border-red-700/40",
  reviewing:  "bg-[#C69214]/15 text-[#E8B84B] border-[#C69214]/30",
  mastered:   "bg-green-900/30 text-green-400 border-green-700/40",
};

const STATUS_NEXT_LABEL: Record<ErrorStatus, string> = {
  unresolved: "Start Reviewing →",
  reviewing:  "Mark Mastered ✓",
  mastered:   "Reset",
};

// ── Deep-Dive Panel ──────────────────────────────────────────────────────

function DeepDivePanel({
  plan,
  loading,
  error,
}: {
  plan: DeepDiveResponse | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="mt-3 rounded-xl border border-[#C69214]/20 bg-[#C69214]/5 p-4 space-y-2 animate-pulse">
        <div className="h-3 w-32 bg-white/10 rounded" />
        <div className="h-3 w-full bg-white/10 rounded" />
        <div className="h-3 w-4/5 bg-white/10 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-red-700/30 bg-red-900/20 p-3 text-xs text-red-400">
        {error}
      </div>
    );
  }

  if (!plan) return null;

  const steps = [
    {
      icon: <BookOpen size={14} />,
      label: "Concept Refresher",
      color: "text-[#E8B84B]",
      border: "border-[#C69214]/25",
      bg: "bg-[#C69214]/8",
      content: plan.refresher,
    },
    {
      icon: <Zap size={14} />,
      label: "Try This Problem",
      color: "text-blue-400",
      border: "border-blue-700/25",
      bg: "bg-blue-900/15",
      content: plan.simplified_problem,
    },
    {
      icon: <FileSearch size={14} />,
      label: "Review This Section",
      color: "text-purple-400",
      border: "border-purple-700/25",
      bg: "bg-purple-900/15",
      content: plan.pdf_pointer,
    },
  ];

  return (
    <div className="mt-3 space-y-2">
      {steps.map((step, i) => (
        <div key={i} className={cn("rounded-xl border p-3", step.border, step.bg)}>
          <div className={cn("flex items-center gap-1.5 mb-1 font-semibold text-xs uppercase tracking-wider", step.color)}>
            {step.icon}
            <span>Step {i + 1} — {step.label}</span>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">{step.content}</p>
        </div>
      ))}
    </div>
  );
}

// ── Error Card ───────────────────────────────────────────────────────────

function ErrorCard({
  err,
  courseId,
  onStatusChange,
}: {
  err: HomeworkError;
  courseId: string;
  onStatusChange: (updated: HomeworkError) => void;
}) {
  const [statusLoading, setStatusLoading] = useState(false);
  const [diveOpen,      setDiveOpen]      = useState(false);
  const [diveLoading,   setDiveLoading]   = useState(false);
  const [diveError,     setDiveError]     = useState<string | null>(null);
  const [divePlan,      setDivePlan]      = useState<DeepDiveResponse | null>(null);

  const handleStatusCycle = async () => {
    if (!err.id) return;
    setStatusLoading(true);
    try {
      const next = STATUS_CYCLE[err.status];
      const updated = await updateErrorStatus(courseId as "math20c" | "cse12", err.id, next);
      onStatusChange(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDeepDive = async () => {
    if (!err.id) return;
    if (diveOpen && divePlan) { setDiveOpen(false); return; }
    setDiveOpen(true);
    if (divePlan) return; // already loaded
    setDiveLoading(true);
    setDiveError(null);
    try {
      const plan = await getDeepDive(courseId as "math20c" | "cse12", err.id);
      setDivePlan(plan);
    } catch (e) {
      setDiveError(e instanceof Error ? e.message : "Deep-dive failed. Is Ollama running?");
    } finally {
      setDiveLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "border rounded-xl px-4 py-3 transition-all duration-200",
        err.status === "mastered"
          ? "bg-white/3 border-white/5 opacity-50"
          : "bg-white/5 border-white/10 hover:border-[#C69214]/20"
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#E8B84B]">
              {err.homework_id} #{err.problem}
            </span>
            <span className="text-xs bg-[#C69214]/15 text-[#C69214] px-1.5 py-0.5 rounded border border-[#C69214]/20">
              {err.topic}
            </span>
            {err.subtopic && (
              <span className="text-xs text-white/30">{err.subtopic}</span>
            )}
            {err.attempts > 1 && (
              <span className="text-xs text-white/20">{err.attempts} attempts</span>
            )}
          </div>
          {err.description && (
            <p className="text-xs text-white/50 mt-1 leading-relaxed">{err.description}</p>
          )}
        </div>

        {/* Status badge + cycle button */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider", STATUS_STYLE[err.status])}>
            {STATUS_LABELS[err.status]}
          </span>
          <button
            onClick={handleStatusCycle}
            disabled={statusLoading}
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors disabled:opacity-30"
          >
            {statusLoading ? "..." : STATUS_NEXT_LABEL[err.status]}
          </button>
        </div>
      </div>

      {/* Deep-Dive button (only for non-mastered errors) */}
      {err.status !== "mastered" && (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={handleDeepDive}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border transition-all",
              diveOpen
                ? "bg-[#C69214]/20 border-[#C69214]/40 text-[#E8B84B]"
                : "bg-white/5 border-white/10 text-white/40 hover:border-[#C69214]/30 hover:text-[#E8B84B]"
            )}
          >
            <Sparkles size={11} />
            {diveOpen ? "Hide Recovery Plan" : "Generate Recovery Plan"}
            {diveOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {divePlan && !diveOpen && (
            <span className="text-[10px] text-white/20">Plan ready</span>
          )}
        </div>
      )}

      {/* Deep-Dive panel */}
      {diveOpen && (
        <DeepDivePanel plan={divePlan} loading={diveLoading} error={diveError} />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const { courseId } = useCourse();
  const [errors,     setErrors]     = useState<HomeworkError[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    homework_id: "", problem: "", topic: "", subtopic: "", description: "",
  });

  const inputCls =
    "w-full bg-white/5 border border-white/15 text-white/80 rounded-lg px-3 py-1.5 text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#C69214]/40 focus:border-[#C69214]/50";

  const fetchErrors = () => {
    setLoading(true);
    getHomeworkErrors(courseId)
      .then((d) => setErrors(d.errors))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchErrors(); }, [courseId]);

  const handleStatusChange = (updated: HomeworkError) => {
    setErrors((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  };

  const handleScreenshot = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = (e) => setScreenshotPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.homework_id || !form.problem || !form.topic) return;
    setSubmitting(true);
    try {
      const newError = await logHomeworkError(courseId, {
        ...form,
        status: "unresolved",
        resolved: false,
        attempts: 1,
      });
      setErrors((prev) => [...prev, newError]);
      setForm({ homework_id: "", problem: "", topic: "", subtopic: "", description: "" });
      setScreenshot(null);
      setScreenshotPreview(null);
      setShowForm(false);
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const unresolved = errors.filter((e) => e.status === "unresolved");
  const reviewing  = errors.filter((e) => e.status === "reviewing");
  const mastered   = errors.filter((e) => e.status === "mastered");

  return (
    <div className="flex-1 overflow-y-auto bg-[#0F1D30] px-6 py-6 max-w-2xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#E8B84B]">My Progress</h1>
          <p className="text-white/40 text-sm mt-1">
            Track mistakes for{" "}
            <strong className="text-white/70">{COURSE_NAMES[courseId]}</strong>.
            Click <span className="text-[#E8B84B]">Generate Recovery Plan</span> on any error for a 3-step fix.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-gradient-to-r from-[#C69214] to-[#E8B84B] text-[#0F1D30] font-semibold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex-shrink-0"
        >
          {showForm ? "Cancel" : "+ Log Error"}
        </button>
      </div>

      {/* Log error form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 animate-slide-up space-y-3"
        >
          <h3 className="font-semibold text-white/80 text-sm">Log a Homework Error</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-1">Homework ID *</label>
              <input value={form.homework_id} onChange={(e) => setForm((f) => ({ ...f, homework_id: e.target.value }))}
                placeholder="HW3, PA1..." required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-1">Problem # *</label>
              <input value={form.problem} onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
                placeholder="4b, removeFirst..." required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-1">Topic *</label>
              <input value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                placeholder="gradient, linked_lists..." required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-1">Subtopic</label>
              <input value={form.subtopic} onChange={(e) => setForm((f) => ({ ...f, subtopic: e.target.value }))}
                placeholder="gradient_direction..." className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-widest mb-1">What went wrong?</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the mistake or misconception..." rows={2}
              className={cn(inputCls, "resize-none")} />
          </div>

          {/* Screenshot upload */}
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-widest mb-1">
              Screenshot (optional)
            </label>
            {screenshotPreview ? (
              <div className="relative inline-block">
                <img src={screenshotPreview} alt="screenshot" className="h-20 rounded-lg border border-white/15 object-cover" />
                <button
                  type="button"
                  onClick={() => { setScreenshot(null); setScreenshotPreview(null); }}
                  className="absolute -top-1.5 -right-1.5 bg-black/70 rounded-full p-0.5"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => screenshotRef.current?.click()}
                className="flex items-center gap-2 text-xs text-white/30 border border-dashed border-white/15 rounded-lg px-3 py-2 hover:border-[#C69214]/30 hover:text-[#E8B84B] transition-all"
              >
                <ImagePlus size={14} />
                Attach a screenshot of the problem
              </button>
            )}
            <input
              ref={screenshotRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleScreenshot(e.target.files[0]); }}
            />
          </div>

          <button type="submit" disabled={submitting}
            className="bg-gradient-to-r from-[#C69214] to-[#E8B84B] text-[#0F1D30] font-semibold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40">
            {submitting ? "Saving..." : "Save Error"}
          </button>
        </form>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-red-900/20 border border-red-700/25 rounded-xl p-4">
          <p className="text-3xl font-black text-red-400">{unresolved.length}</p>
          <p className="text-xs text-red-500/70 mt-0.5">Unresolved</p>
        </div>
        <div className="bg-[#C69214]/10 border border-[#C69214]/25 rounded-xl p-4">
          <p className="text-3xl font-black text-[#E8B84B]">{reviewing.length}</p>
          <p className="text-xs text-[#C69214]/70 mt-0.5">Reviewing</p>
        </div>
        <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4">
          <p className="text-3xl font-black text-green-400">{mastered.length}</p>
          <p className="text-xs text-green-500/70 mt-0.5">Mastered ✓</p>
        </div>
      </div>

      {/* Error list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : errors.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <p className="text-3xl mb-2">🌟</p>
          <p className="text-sm font-medium text-white/50">No errors logged yet</p>
          <p className="text-xs mt-1">Log mistakes as you review homework to get personalized recovery plans</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Active errors first */}
          {[...unresolved, ...reviewing, ...mastered].map((err) => (
            <ErrorCard
              key={err.id}
              err={err}
              courseId={courseId}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
