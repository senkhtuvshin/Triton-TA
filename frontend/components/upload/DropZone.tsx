"use client";
import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { type CourseId } from "@/lib/types";
import { uploadPdf } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  courseId: CourseId;
  onSuccess: (message: string, spark?: string[], eventsAdded?: number) => void;
  onError: (message: string) => void;
}

const DOC_TYPES = [
  { value: "syllabus",       label: "Syllabus" },
  { value: "lecture_notes",  label: "Lecture Notes" },
  { value: "homework",       label: "Homework" },
  { value: "practice_exam",  label: "Practice Exam" },
];

export default function DropZone({ courseId, onSuccess, onError }: DropZoneProps) {
  const [dragging,  setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType,   setDocType]   = useState("syllabus");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".pdf")) { onError("Only PDF files are accepted."); return; }
    if (file.size > 20 * 1024 * 1024) { onError("File too large. Max 20MB."); return; }
    setUploading(true);
    try {
      const result = await uploadPdf(file, courseId, docType);
      onSuccess(
        `✓ ${result.message}`,
        result.summary_spark ?? [],
        result.extracted_events?.length ?? 0,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Document type selector */}
      <div>
        <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-1.5">
          Document Type
        </label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="w-full bg-white/5 border border-white/15 text-white/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C69214]/40 focus:border-[#C69214]/50"
        >
          {DOC_TYPES.map((t) => (
            <option key={t.value} value={t.value} className="bg-[#182B49]">{t.label}</option>
          ))}
        </select>
        {docType === "syllabus" && (
          <p className="mt-1.5 text-[11px] text-[#C69214]/70 leading-snug">
            ✦ Syllabus uploads auto-extract exam dates into the Midterm Countdown and generate a Summary Spark.
          </p>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300",
          dragging
            ? "border-[#C69214] bg-[#C69214]/10 shadow-[0_0_30px_rgba(198,146,20,0.15)]"
            : "border-white/15 hover:border-[#C69214]/40 hover:bg-white/5",
          uploading && "opacity-50 cursor-wait"
        )}
      >
        <input ref={inputRef} type="file" accept=".pdf" onChange={handleChange} className="hidden" />
        <div className="text-4xl mb-3">{uploading ? "⏳" : dragging ? "📂" : "📄"}</div>
        <p className="font-medium text-white/70 text-sm">
          {uploading ? "Indexing PDF..." : "Drop your PDF here or click to browse"}
        </p>
        <p className="text-white/30 text-xs mt-1">PDF only · Max 20MB</p>
      </div>
    </div>
  );
}
