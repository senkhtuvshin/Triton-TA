"use client";
import { useState } from "react";
import { X, BookPlus } from "lucide-react";

interface AddCourseModalProps {
  onAdd: (code: string, name: string) => void;
  onClose: () => void;
}

export default function AddCourseModal({ onAdd, onClose }: AddCourseModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const canSave = code.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onAdd(code.trim(), name.trim() || code.trim().toUpperCase());
    onClose();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#182B49] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BookPlus size={16} className="text-[#E8B84B]" />
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">
              Add Course
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1.5">
              Course Code <span className="text-[#E8B84B]">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. CSE 105"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKey}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#C69214]/60 focus:bg-white/8 transition-colors"
            />
          </div>

          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1.5">
              Course Name <span className="text-white/20">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Theory of Computation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKey}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#C69214]/60 transition-colors"
            />
          </div>
        </div>

        {/* Hint */}
        <p className="text-white/20 text-[10px] mt-3 leading-relaxed">
          The TA will use general knowledge for unlisted courses.
          Upload a syllabus PDF after adding to enable full context.
        </p>

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-white/40 text-xs font-medium border border-white/10 hover:border-white/25 hover:text-white/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              background: canSave
                ? "linear-gradient(45deg, #C69214, #E8B84B)"
                : undefined,
            }}
            className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
              disabled:bg-white/10 disabled:text-white/20 disabled:cursor-not-allowed
              enabled:text-[#0F1D30]"
          >
            Add Course
          </button>
        </div>
      </div>
    </div>
  );
}
