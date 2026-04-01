"use client";
import { usePathname, useRouter } from "next/navigation";
import { Home, MessageCircle, FileUp, BarChart2, CalendarDays, type LucideIcon } from "lucide-react";
import type { Course } from "@/lib/types";
import CourseSelector from "@/components/sidebar/CourseSelector";
import CountdownWidget from "@/components/sidebar/CountdownWidget";
import GradientPillButton from "@/components/ui/gradient-pill-button";
import UserMenu from "@/components/layout/UserMenu";

interface SidebarProps {
  courses: Course[];
  courseId: string;
  onCourseChange: (id: string) => void;
  onAddCourse: (code: string, name: string) => void;
  onRemoveCourse: (id: string) => void;
  onProblemClick: (problem: string, source: string) => void;
}

const NAV_LINKS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/home",     label: "Home",         Icon: Home          },
  { href: "/chat",     label: "Chat with TA", Icon: MessageCircle },
  { href: "/upload",   label: "Upload PDFs",  Icon: FileUp        },
  { href: "/progress", label: "My Progress",  Icon: BarChart2     },
  { href: "/calendar", label: "Calendar",     Icon: CalendarDays  },
];

export default function Sidebar({
  courses,
  courseId,
  onCourseChange,
  onAddCourse,
  onRemoveCourse,
  onProblemClick,
}: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <aside className="w-64 flex-shrink-0 bg-ucsd-navy flex flex-col h-full overflow-y-auto">
      <div className="pt-4 pb-2">
        <CourseSelector
          courses={courses}
          selected={courseId}
          onChange={onCourseChange}
          onAdd={onAddCourse}
          onRemove={onRemoveCourse}
        />
      </div>

      {/* Navigation */}
      <div className="px-3 mb-4">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-3 px-1">Navigate</p>
        <div className="flex flex-col gap-2 items-start">
          {NAV_LINKS.map(({ href, label, Icon }) => (
            <GradientPillButton
              key={href}
              icon={<Icon size={18} />}
              label={label}
              active={pathname === href}
              onClick={() => router.push(href)}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-white/10 mb-4" />

      {/* Countdown + practice problems */}
      <CountdownWidget courseId={courseId} onProblemClick={onProblemClick} />

      {/* Footer */}
      <div className="mt-auto px-3 pb-4 space-y-2">
        <UserMenu />
        <p className="text-white/15 text-[10px] text-center tracking-wide">UCSD Course Agent</p>
      </div>
    </aside>
  );
}
