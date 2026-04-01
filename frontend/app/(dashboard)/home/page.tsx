"use client";
import { useEffect, useState } from "react";
import { MessageCircle, FileUp, BarChart2, Timer, BookOpen, CalendarDays, X } from "lucide-react";
import RadialOrbitalTimeline, { type TimelineItem } from "@/components/ui/radial-orbital-timeline";
import { getBriefing, getTrendingTopics } from "@/lib/api";
import type { BriefingResponse, TrendingTopic } from "@/lib/types";
import { useCourse } from "@/lib/CourseContext";

// ── Static node definitions (badge injected dynamically) ─────────────────

function buildTimelineData(staleCount: number): TimelineItem[] {
  return [
    {
      id: 1,
      title: "Chat with TA",
      date: "MATH 20C · CSE 12",
      content:
        "Ask questions about multivariable calculus or data structures. The Socratic TA guides you to answers through targeted hints rather than giving them away.",
      category: "Learning",
      icon: MessageCircle,
      relatedIds: [5, 3],
      status: "in-progress",
      energy: 85,
      href: "/chat",
    },
    {
      id: 2,
      title: "Upload PDFs",
      date: "Course Materials",
      content:
        "Upload lecture notes, worksheets, and past exams. They get indexed into the RAG vector store so the TA can cite exact passages when answering.",
      category: "Setup",
      icon: FileUp,
      relatedIds: [1, 3],
      status: "completed",
      energy: 100,
      href: "/upload",
    },
    {
      id: 3,
      title: "My Progress",
      date: "Spring 2026",
      content:
        "Track which topics you've struggled with across sessions. Homework errors are logged and surfaced as targeted practice suggestions.",
      category: "Analytics",
      icon: BarChart2,
      relatedIds: [1, 4, 5],
      status: "in-progress",
      energy: 60,
      href: "/progress",
      badge: staleCount,   // injected from briefing
    },
    {
      id: 4,
      title: "Midterm Countdown",
      date: "Next Exam",
      content:
        "Reads your syllabus JSON to compute exact days until your next midterm or final. Urgency level escalates as the date approaches.",
      category: "Schedule",
      icon: Timer,
      relatedIds: [3, 5],
      status: "pending",
      energy: 40,
      href: "/progress",
    },
    {
      id: 5,
      title: "Practice Problems",
      date: "Auto-generated",
      content:
        "Problems are suggested based on your past homework errors. Each one links back into the Chat so you can work through it with the TA.",
      category: "Practice",
      icon: BookOpen,
      relatedIds: [1, 3, 4],
      status: "pending",
      energy: 30,
      href: "/chat",
    },
    {
      id: 6,
      title: "Triton Calendar",
      date: "Semester View",
      content:
        "All your deadlines, exams, and assignments in one place. Study Pulse highlights the days before each exam based on your unresolved errors.",
      category: "Schedule",
      icon: CalendarDays,
      relatedIds: [3, 4],
      status: "pending",
      energy: 55,
      href: "/calendar",
    },
  ];
}

// ── Briefing Banner ──────────────────────────────────────────────────────

function BriefingBanner({
  briefing,
  trending,
  onDismiss,
}: {
  briefing:  BriefingResponse;
  trending:  TrendingTopic[];
  onDismiss: () => void;
}) {
  // ── Getting Started variant (no errors logged yet) ──────────────────────
  if (briefing.is_new_course) {
    return (
      <div className="relative mx-6 mt-4 rounded-xl border border-white/10 bg-white/3 px-4 py-3 flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">🚀</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-[#E8B84B] uppercase tracking-widest mb-1">
            Getting Started
          </p>
          <p className="text-sm text-white/70 leading-relaxed">{briefing.greeting}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              { step: "1", label: "Upload your syllabus PDF" },
              { step: "2", label: "Chat with the TA about anything" },
              { step: "3", label: "Log your first homework error" },
            ].map(({ step, label }) => (
              <span key={step} className="inline-flex items-center gap-1.5 text-[10px] text-white/40">
                <span className="w-4 h-4 rounded-full bg-[#C69214]/20 text-[#C69214] flex items-center justify-center font-bold text-[9px]">
                  {step}
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>
        <button onClick={onDismiss} className="shrink-0 text-white/30 hover:text-white/60 transition-colors mt-0.5">
          <X size={14} />
        </button>
      </div>
    );
  }

  // ── Returning student variant ─────────────────────────────────────────
  return (
    <div className="relative mx-6 mt-4 rounded-xl border border-[#C69214]/30 bg-[#C69214]/8 px-4 py-3 flex items-start gap-3">
      {/* Triton icon */}
      <span className="text-xl shrink-0 mt-0.5">🔱</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 leading-relaxed">{briefing.greeting}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {briefing.has_stale_errors && (
            <span className="text-[10px] uppercase tracking-widest text-red-400 font-semibold">
              {briefing.stale_count} unresolved · {briefing.stale_topics.join(", ")}
            </span>
          )}
          {briefing.next_exam_title && briefing.days_until_exam !== undefined && (
            <span className="text-[10px] uppercase tracking-widest text-[#C69214]/70 font-semibold">
              {briefing.next_exam_title} in {briefing.days_until_exam}d
            </span>
          )}
        </div>

        {/* Community heat map */}
        {trending.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-widest text-white/35 mb-1.5 font-medium">
              🔥 Triton Community struggling with
            </p>
            <div className="flex flex-wrap gap-1.5">
              {trending.map((t) => (
                <span
                  key={t.topic}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-[10px] text-red-400/80 font-medium"
                >
                  🔥 {t.topic}
                  <span className="text-red-400/50">{t.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="shrink-0 text-white/30 hover:text-white/60 transition-colors mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { courseId, courses } = useCourse();
  const [briefing,        setBriefing]        = useState<BriefingResponse | null>(null);
  const [dismissed,       setDismissed]       = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [trending,        setTrending]        = useState<TrendingTopic[]>([]);

  useEffect(() => {
    setBriefingLoading(true);
    setDismissed(false);
    getBriefing(courseId)
      .then(setBriefing)
      .catch(console.error)
      .finally(() => setBriefingLoading(false));

    getTrendingTopics(courseId)
      .then((r) => setTrending(r.trending))
      .catch(() => setTrending([]));
  }, [courseId]);

  const staleCount   = briefing?.stale_count ?? 0;
  const timelineData = buildTimelineData(staleCount);
  const showBanner   = !dismissed && !briefingLoading && briefing !== null;

  return (
    <div className="relative h-full flex flex-col bg-[#0F1D30] overflow-hidden">

      {/* Animated UCSD blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="ucsd-blob-1 absolute w-[600px] h-[600px] opacity-25 blur-[90px]" />
        <div className="ucsd-blob-2 absolute w-[500px] h-[500px] opacity-20 blur-[80px]" />
        <div className="ucsd-blob-3 absolute w-[420px] h-[420px] opacity-30 blur-[70px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(198,146,20,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(198,146,20,0.6) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Title */}
      <div className="relative shrink-0 px-6 pt-6 pb-1 text-center">
        <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-lg">
          UCSD Course Agent
        </h1>
        <p className="text-white/40 text-sm mt-0.5">
          {courses.length > 0
            ? courses.map((c) => c.code).join(" · ")
            : "Spring 2026"}
        </p>
      </div>

      {/* Daily Triton Briefing */}
      {briefingLoading && (
        <div className="relative mx-6 mt-4 h-12 rounded-xl bg-white/5 animate-pulse" />
      )}
      {showBanner && (
        <div className="relative shrink-0">
          <BriefingBanner
            briefing={briefing!}
            trending={trending}
            onDismiss={() => setDismissed(true)}
          />
        </div>
      )}

      {/* Orbital timeline */}
      <div className="relative flex-1 min-h-0">
        <RadialOrbitalTimeline timelineData={timelineData} />
      </div>
    </div>
  );
}
