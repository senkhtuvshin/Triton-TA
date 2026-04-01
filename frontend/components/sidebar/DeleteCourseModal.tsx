"use client";
import { useState } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import type { Course } from "@/lib/types";
import { deleteCourseData } from "@/lib/api";

interface DeleteCourseModalProps {
  course: Course;
  onConfirm: (courseId: string) => void;   // called after successful delete
  onClose: () => void;
}

export default function DeleteCourseModal({ course, onConfirm, onClose }: DeleteCourseModalProps) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteCourseData(course.id);
      onConfirm(course.id);      // parent handles localStorage + redirect
    } catch (err) {
      setError("Failed to delete course data. The course will still be removed from your sidebar.");
      // Even if the backend call fails, remove from the sidebar after a beat
      setTimeout(() => onConfirm(course.id), 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="bg-[#182B49] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={14} className="text-red-400" />
            </div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">
              Remove Course
            </h3>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/60 transition-colors -mt-0.5"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Body */}
        <p className="text-white/70 text-sm leading-relaxed mb-1">
          Are you sure you want to remove{" "}
          <span className="text-white font-semibold">{course.code}</span>?
        </p>
        <p className="text-white/40 text-xs leading-relaxed mb-5">
          This will delete all synced assignments, calendar events, and uploaded PDFs for this course.
        </p>

        {error && (
          <p className="text-red-400 text-xs mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-white/40 text-xs font-medium
              border border-white/10 hover:border-white/25 hover:text-white/60
              transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider
              bg-red-500/80 hover:bg-red-500 text-white transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Removing…
              </>
            ) : (
              <>
                <Trash2 size={11} />
                Remove
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
