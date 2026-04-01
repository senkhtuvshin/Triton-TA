"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useCourse } from "@/lib/CourseContext";
import { COURSE_NAMES } from "@/lib/types";
import DropZone from "@/components/upload/DropZone";
import UploadedFileList from "@/components/upload/UploadedFileList";

export default function UploadPage() {
  const { courseId } = useCourse();
  const [toast,      setToast]      = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [summarySparkBullets, setSummarySparkBullets] = useState<string[]>([]);
  const [extractedCount,      setExtractedCount]      = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = (message: string, spark?: string[], eventsAdded?: number) => {
    setToast({ type: "success", message });
    setSummarySparkBullets(spark ?? []);
    setExtractedCount(eventsAdded ?? null);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setToast(null), 6000);
  };

  const handleError = (message: string) => {
    setToast({ type: "error", message });
    setSummarySparkBullets([]);
    setExtractedCount(null);
    setTimeout(() => setToast(null), 5000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0F1D30] px-6 py-6 max-w-2xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#E8B84B]">Upload Course Materials</h1>
        <p className="text-white/40 text-sm mt-1">
          Add PDFs for <strong className="text-white/70">{COURSE_NAMES[courseId]}</strong> — lecture
          notes, homework, practice exams, etc. The TA will cite these in every response.
          Syllabus PDFs automatically update the Midterm Countdown.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm border animate-slide-up ${
            toast.type === "success"
              ? "bg-green-900/30 text-green-400 border-green-800/50"
              : "bg-red-900/30 text-red-400 border-red-800/50"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Summary Spark — shown after syllabus upload */}
      {summarySparkBullets.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#C69214]/30 bg-[#C69214]/8 p-4 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-[#E8B84B]" />
            <span className="text-xs font-semibold text-[#E8B84B] uppercase tracking-widest">
              Summary Spark
              {extractedCount !== null && extractedCount > 0 &&
                ` · ${extractedCount} date${extractedCount !== 1 ? "s" : ""} added to countdown`}
            </span>
          </div>
          <ul className="space-y-1">
            {summarySparkBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                <span className="text-[#C69214] mt-0.5 shrink-0">•</span>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white/5 rounded-xl border border-white/10 p-5 mb-6">
        <DropZone
          courseId={courseId}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white/50 mb-3 uppercase tracking-widest">
          Indexed Documents — {COURSE_NAMES[courseId]}
        </h2>
        <UploadedFileList courseId={courseId} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
