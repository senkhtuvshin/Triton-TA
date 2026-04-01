"use client";
import type { Course } from "@/lib/types";

interface CourseFilterProps {
  courses:  Course[];
  active:   Set<string>;
  onToggle: (id: string) => void;
}

/** Colour assigned to each course for calendar event dots. */
export function courseColor(index: number): string {
  const palette = [
    "#C69214",  // UCSD gold   (first course)
    "#3B82F6",  // blue        (second)
    "#10B981",  // emerald
    "#A855F7",  // purple
    "#F97316",  // orange
    "#EC4899",  // pink
  ];
  return palette[index % palette.length];
}

export default function CourseFilter({ courses, active, onToggle }: CourseFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {courses.map((course, i) => {
        const color   = courseColor(i);
        const enabled = active.has(course.id);
        return (
          <button
            key={course.id}
            onClick={() => onToggle(course.id)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border"
            style={{
              borderColor: color,
              background:  enabled ? color + "22" : "transparent",
              color:        enabled ? color        : "#ffffff55",
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: enabled ? color : "#ffffff33" }}
            />
            {course.code}
          </button>
        );
      })}
    </div>
  );
}
