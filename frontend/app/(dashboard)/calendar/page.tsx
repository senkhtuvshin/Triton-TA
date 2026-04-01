"use client";
import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Plus, Loader2, RefreshCw } from "lucide-react";
import { useCourse } from "@/lib/CourseContext";
import {
  getCalendarEvents,
  getHomeworkErrors,
  toggleEventComplete,
  deleteCalendarEvent,
  addCalendarEvent,
} from "@/lib/api";
import type { CalendarEvent, Course } from "@/lib/types";
import CalendarView from "@/components/calendar/CalendarView";
import CourseFilter, { courseColor } from "@/components/calendar/CourseFilter";

// ── Add-Event modal ───────────────────────────────────────────────────────

function AddEventModal({
  courseId,
  onSave,
  onClose,
}: {
  courseId: string;
  onSave: (event: CalendarEvent) => void;
  onClose: () => void;
}) {
  const [title,   setTitle]   = useState("");
  const [type,    setType]    = useState("ASSIGNMENT");
  const [date,    setDate]    = useState("");
  const [weight,  setWeight]  = useState(0);
  const [desc,    setDesc]    = useState("");
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const ev = await addCalendarEvent(courseId, {
        title: title.trim(),
        type,
        due_date: date || "TBD",
        weight,
        description: desc.trim(),
      });
      onSave(ev);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#182B49] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl">
        <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Add Event</h3>

        <div className="space-y-3">
          <input
            autoFocus
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#C69214]/50"
          />
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
            >
              {["EXAM","ASSIGNMENT","QUIZ","LECTURE","OFFICE_HOURS"].map((t) => (
                <option key={t} value={t} className="bg-[#182B49]">{t}</option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-white/40 text-xs shrink-0">Grade %</label>
            <input
              type="number"
              min={0} max={100}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none resize-none"
          />
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-white/40 text-xs font-medium border border-white/10 hover:border-white/25 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            style={{ background: "linear-gradient(45deg, #C69214, #E8B84B)" }}
            className="flex-1 py-2 rounded-lg text-[#0F1D30] text-xs font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { courseId, courses } = useCourse();

  const [events,           setEvents]           = useState<CalendarEvent[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [activeCourses,    setActiveCourses]    = useState<Set<string>>(new Set());
  const [unresolvedTopics, setUnresolvedTopics] = useState<Record<string, string[]>>({});
  const [showAddModal,     setShowAddModal]     = useState(false);

  // ── Load events for ALL courses ───────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    const allEvents: CalendarEvent[] = [];
    const topicMap: Record<string, string[]> = {};

    await Promise.allSettled(
      courses.map(async (course) => {
        // Calendar events
        try {
          const res = await getCalendarEvents(course.id);
          allEvents.push(...res.events);
        } catch {/* skip */}

        // Unresolved error topics for Study Pulse
        try {
          const errRes = await getHomeworkErrors(course.id);
          topicMap[course.id] = errRes.errors
            .filter((e) => e.status === "unresolved")
            .map((e) => e.topic.replace(/_/g, " "));
        } catch {/* skip */}
      })
    );

    setEvents(allEvents);
    setUnresolvedTopics(topicMap);
    setLoading(false);
  }, [courses]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Default: activate the current course
  useEffect(() => {
    setActiveCourses((prev) => {
      if (prev.has(courseId)) return prev;
      return new Set([...prev, courseId]);
    });
  }, [courseId]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const toggleCourse = (id: string) => {
    setActiveCourses((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    try {
      await toggleEventComplete(id, completed);
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, completed } : e));
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCalendarEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleAdd = (ev: CalendarEvent) => {
    setEvents((prev) => [...prev, ev]);
  };

  // ── Grade weight totals ────────────────────────────────────────────────

  const gradeTotal = events
    .filter((e) => activeCourses.has(e.course_id) && e.weight > 0)
    .reduce((sum, e) => sum + e.weight, 0);

  const upcomingCount = events.filter((e) => {
    if (!activeCourses.has(e.course_id)) return false;
    if (!e.due_date || e.due_date === "TBD") return false;
    const d = new Date(e.due_date);
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / 86400000;
    return diff >= 0 && diff <= 14;
  }).length;

  return (
    <div className="flex flex-col h-full bg-[#0F1D30] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-[#C69214]" />
          <h1 className="text-white font-bold text-base">Triton Calendar</h1>
          <span className="text-white/30 text-xs">Spring 2026</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px] text-white/40">
          {upcomingCount > 0 && (
            <span className="text-[#E8B84B]/80">{upcomingCount} due in 14d</span>
          )}
          {gradeTotal > 0 && (
            <span>{gradeTotal}% of grade visible</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="p-1.5 text-white/30 hover:text-white/60 transition-colors rounded-lg hover:bg-white/5"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#0F1D30] uppercase tracking-wider"
            style={{ background: "linear-gradient(45deg, #C69214, #E8B84B)" }}
          >
            <Plus size={13} /> Add Event
          </button>
        </div>
      </div>

      {/* Course filter row */}
      <div className="shrink-0 px-5 py-2.5 border-b border-white/5 flex items-center gap-3">
        <span className="text-white/25 text-[10px] uppercase tracking-widest shrink-0">Layers</span>
        <CourseFilter
          courses={courses}
          active={activeCourses}
          onToggle={toggleCourse}
        />
        {activeCourses.size < courses.length && (
          <button
            onClick={() => setActiveCourses(new Set(courses.map((c) => c.id)))}
            className="text-[10px] text-white/25 hover:text-white/50 transition-colors ml-auto shrink-0"
          >
            Show all
          </button>
        )}
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="text-[#C69214] animate-spin" />
          </div>
        ) : (
          <CalendarView
            events={events}
            courses={courses}
            activeCourses={activeCourses}
            unresolvedTopics={unresolvedTopics}
            onToggleComplete={handleToggleComplete}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Add Event modal */}
      {showAddModal && (
        <AddEventModal
          courseId={courseId}
          onSave={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
