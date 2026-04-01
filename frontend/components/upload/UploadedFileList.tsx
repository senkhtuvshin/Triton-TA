"use client";
import { useEffect, useState } from "react";
import { type CourseId, type DocumentInfo } from "@/lib/types";
import { getDocuments } from "@/lib/api";

interface UploadedFileListProps {
  courseId: CourseId;
  refreshKey: number;
}

export default function UploadedFileList({ courseId, refreshKey }: UploadedFileListProps) {
  const [docs, setDocs]     = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDocuments(courseId)
      .then((data) => setDocs(data.documents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseId, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!docs.length) {
    return (
      <div className="text-center py-8 text-white/30">
        <p className="text-sm">No PDFs indexed yet</p>
        <p className="text-xs mt-1">Upload course materials above to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <div
          key={doc.document_id}
          className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 hover:border-[#C69214]/25 transition-colors"
        >
          <span className="text-lg">📄</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/80 truncate">{doc.file_name}</p>
            <p className="text-xs text-white/30">
              {doc.document_type} · {doc.chunks_indexed} chunks · {new Date(doc.uploaded_at).toLocaleDateString()}
            </p>
          </div>
          <span className="text-xs bg-[#C69214]/15 text-[#E8B84B] border border-[#C69214]/25 px-2 py-0.5 rounded-full">
            indexed
          </span>
        </div>
      ))}
    </div>
  );
}
