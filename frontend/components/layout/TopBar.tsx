"use client";
import { COURSE_NAMES, COURSE_FULL_NAMES, type CourseId } from "@/lib/types";

interface TopBarProps {
  courseId: CourseId;
}

export default function TopBar({ courseId }: TopBarProps) {
  return (
    <header className="h-14 bg-ucsd-navy flex items-center px-6 shadow-md flex-shrink-0">
      {/* UCSD Wordmark */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-ucsd-gold flex items-center justify-center flex-shrink-0">
          <span className="text-ucsd-navy font-black text-xs">UC</span>
        </div>
        <div className="hidden sm:block">
          <span className="text-white font-bold text-sm leading-tight">UC San Diego</span>
          <span className="text-ucsd-gold text-xs block leading-tight">Course Agent</span>
        </div>
      </div>

      <div className="mx-4 h-6 w-px bg-ucsd-navy-light hidden sm:block" />

      {/* Active course pill */}
      <div className="bg-ucsd-navy-light border border-ucsd-gold/30 rounded-full px-3 py-1">
        <span className="text-ucsd-gold font-semibold text-sm">{COURSE_NAMES[courseId]}</span>
        <span className="text-white/70 text-xs ml-1.5 hidden md:inline">{COURSE_FULL_NAMES[courseId]}</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-white/60 text-xs hidden sm:inline">TA Online</span>
      </div>
    </header>
  );
}
