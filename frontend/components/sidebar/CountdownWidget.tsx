"use client";
import { useEffect, useState } from "react";
import { getSyllabus } from "@/lib/api";
import { type CourseId, type SyllabusResponse } from "@/lib/types";
import { formatDate, urgencyDotColor } from "@/lib/utils";
import { useCourse } from "@/lib/CourseContext";
import PracticeProblems from "./PracticeProblems";

interface CountdownWidgetProps {
  courseId: CourseId;
  onProblemClick: (problem: string, source: string) => void;
}

export default function CountdownWidget({ courseId, onProblemClick }: CountdownWidgetProps) {
  const { refreshKey } = useCourse();
  const [data,    setData]    = useState<SyllabusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSyllabus(courseId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));

    // Refresh every 5 minutes in the background
    const interval = setInterval(() => {
      getSyllabus(courseId).then(setData).catch(console.error);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  // refreshKey is intentionally included: any successful event save triggers a re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, refreshKey]);

  if (loading) {
    return (
      <div className="mx-3 mb-4 rounded-lg bg-white/5 p-3 animate-pulse">
        <div className="h-3 w-20 bg-white/10 rounded mb-2" />
        <div className="h-8 w-12 bg-white/10 rounded mb-1" />
        <div className="h-3 w-28 bg-white/10 rounded" />
      </div>
    );
  }

  if (!data?.next_exam) {
    return (
      <div className="mx-3 mb-4 rounded-lg bg-white/5 border border-white/10 p-3">
        <p className="text-white/50 text-xs">No upcoming exams</p>
      </div>
    );
  }

  const { next_exam, suggested_problems } = data;
  const dotClass = urgencyDotColor(next_exam.urgency);

  return (
    <div className="mx-3 mb-4 space-y-2">
      {/* Countdown card */}
      <div className="rounded-lg border border-white/10 bg-white/5 border-l-2 border-l-amber-500/50 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {next_exam.exam_title}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-amber-400">{next_exam.days_remaining}</span>
          <span className="text-sm font-medium text-amber-400/70">days left</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">{formatDate(next_exam.exam_date)}</p>
      </div>

      {/* Suggested problems */}
      {suggested_problems.length > 0 && (
        <PracticeProblems
          problems={suggested_problems.slice(0, 4)}
          onProblemClick={onProblemClick}
        />
      )}
    </div>
  );
}
