"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CourseContext } from "@/lib/CourseContext";
import { useAuth } from "@/lib/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  loadCourses,
  addCourse  as registryAdd,
  removeCourse as registryRemove,
  codeToId,
} from "@/lib/courseRegistry";
import { DEFAULT_COURSES, type Course } from "@/lib/types";
import TopBar from "@/components/layout/TopBar";
import Sidebar from "@/components/layout/Sidebar";
import AuthModal from "@/components/auth/AuthModal";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [courses,    setCourses]    = useState<Course[]>(DEFAULT_COURSES);
  const [courseId,   setCourseId]   = useState<string>("math20c");
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  const router   = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Hydrate course list from localStorage on mount
  useEffect(() => {
    setCourses(loadCourses());
  }, []);

  // Sync active courseId from the URL when navigating to /course/[id].
  // This keeps state correct on hard-reload, bookmark, or browser back/forward.
  useEffect(() => {
    const match = pathname.match(/^\/course\/([^/]+)/);
    if (match) {
      const idFromUrl = match[1];
      // Only accept it if it's a real course the user has added
      const exists = courses.find((c) => c.id === idFromUrl);
      if (exists && idFromUrl !== courseId) {
        setCourseId(idFromUrl);
      }
    }
  }, [pathname, courses]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Course management ───────────────────────────────────────────────────────

  const handleAddCourse = (code: string, name: string) => {
    const updated = registryAdd(courses, code, name);
    setCourses(updated);
    const id = codeToId(code);
    setCourseId(id);
    // Mirror the new course into the backend registry (fire-and-forget)
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, code: code.toUpperCase(), name }),
    }).catch(() => {/* non-critical — localStorage is the primary store */});
    router.push(`/course/${id}`);
  };

  const handleRemoveCourse = (id: string) => {
    const updated = registryRemove(courses, id);
    setCourses(updated);
    // Always redirect home; if the sidebar is now empty the user can add a course
    if (courseId === id) {
      setCourseId(updated[0]?.id ?? "");
      router.push("/home");
    }
  };

  // ── Practice problem shortcut ───────────────────────────────────────────────

  const handleProblemClick = (problem: string, source: string) => {
    const message = `Can you help me with ${source} problem #${problem}?`;
    if (pathname === "/chat") {
      window.dispatchEvent(new CustomEvent("prefill-chat", { detail: { message } }));
    } else {
      router.push(`/chat?q=${encodeURIComponent(message)}`);
    }
  };

  // ── Auth gate ───────────────────────────────────────────────────────────────

  const showAuthModal = isSupabaseConfigured && !loading && !user;
  const currentCourse = courses.find((c) => c.id === courseId);

  return (
    <CourseContext.Provider value={{ courseId, courses, currentCourse, refreshKey, triggerRefresh }}>
      <div className="flex flex-col h-screen bg-[#0F1D30]">
        <TopBar courseId={courseId} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            courses={courses}
            courseId={courseId}
            onCourseChange={setCourseId}
            onAddCourse={handleAddCourse}
            onRemoveCourse={handleRemoveCourse}
            onProblemClick={handleProblemClick}
          />
          <main className="flex-1 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </div>
      {showAuthModal && <AuthModal />}
    </CourseContext.Provider>
  );
}
