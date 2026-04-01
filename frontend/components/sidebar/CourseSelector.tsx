"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import type { Course } from "@/lib/types";
import GradientPillButton from "@/components/ui/gradient-pill-button";
import AddCourseModal from "@/components/sidebar/AddCourseModal";
import DeleteCourseModal from "@/components/sidebar/DeleteCourseModal";

interface CourseSelectorProps {
  courses: Course[];
  selected: string;
  onChange: (id: string) => void;
  onAdd: (code: string, name: string) => void;
  onRemove: (id: string) => void;
}

export default function CourseSelector({
  courses,
  selected,
  onChange,
  onAdd,
  onRemove,
}: CourseSelectorProps) {
  const router = useRouter();
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [courseToDelete,  setCourseToDelete]  = useState<Course | null>(null);
  const [hoveredId,       setHoveredId]       = useState<string | null>(null);

  const handleConfirmDelete = (courseId: string) => {
    onRemove(courseId);           // removes from localStorage + React state
    setCourseToDelete(null);
    router.push("/home");         // leave the ghost page
  };

  return (
    <div className="px-3 mb-4">
      <p className="text-white/40 text-xs uppercase tracking-widest mb-3 px-1">Courses</p>

      <div className="flex flex-col gap-2 items-start">
        {courses.map((course) => {
          const isHovered = hoveredId === course.id;
          const isActive  = selected === course.id;

          return (
            <div
              key={course.id}
              className="flex items-center gap-1.5"
              onMouseEnter={() => setHoveredId(course.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <GradientPillButton
                icon={<BookOpen size={18} />}
                label={course.code}
                sublabel={course.name || undefined}
                active={isActive}
                onClick={() => {
                  onChange(course.id);
                  router.push(`/course/${course.id}`);
                }}
              />

              {/* Trash — fades in on hover, sits beside the pill (no absolute hacks) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCourseToDelete(course);
                }}
                title="Remove Course"
                className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center z-50
                  text-red-400 hover:text-red-500 hover:bg-red-500/15
                  transition-all duration-150
                  ${isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            </div>
          );
        })}

        {/* ── Add Course pill ───────────────────────────────────────────────── */}
        <button
          onClick={() => setShowAddModal(true)}
          className="relative h-10 rounded-full flex items-center overflow-hidden
            border border-dashed border-white/15 hover:border-[#C69214]/50
            text-white/35 hover:text-[#E8B84B] cursor-pointer
            transition-colors duration-200"
          style={{ width: "40px", transition: "width 400ms cubic-bezier(0.4,0,0.2,1), border-color 200ms, color 200ms" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.width = "212px"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.width = "40px"; }}
        >
          <span className="shrink-0 flex items-center justify-center" style={{ width: 40 }}>
            <Plus size={16} />
          </span>
          <span className="whitespace-nowrap text-[11px] uppercase tracking-wider font-medium pr-3">
            Add Course
          </span>
        </button>
      </div>

      {showAddModal && (
        <AddCourseModal
          onAdd={onAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {courseToDelete && (
        <DeleteCourseModal
          course={courseToDelete}
          onConfirm={handleConfirmDelete}
          onClose={() => setCourseToDelete(null)}
        />
      )}
    </div>
  );
}
