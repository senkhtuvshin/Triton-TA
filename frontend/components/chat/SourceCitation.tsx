"use client";
import { useState } from "react";
import { type SourceCitation as SourceCitationType } from "@/lib/types";

interface SourceCitationProps {
  sources: SourceCitationType[];
}

export default function SourceCitation({ sources }: SourceCitationProps) {
  const [open, setOpen] = useState(false);

  if (!sources.length) return null;

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <span className="text-ucsd-navy/60">📚</span>
        <span>{sources.length} source{sources.length > 1 ? "s" : ""} cited</span>
        <span className="text-gray-300">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 animate-fade-in">
          {sources.map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-md px-2.5 py-1.5 border border-gray-100">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-xs font-medium text-ucsd-navy truncate">{s.file}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {Math.round(s.score * 100)}% match
                </span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{s.preview}…</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
