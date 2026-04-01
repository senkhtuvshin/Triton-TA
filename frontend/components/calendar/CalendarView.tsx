"use client";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Trash2 } from "lucide-react";
import type { CalendarEvent, Course } from "@/lib/types";
import { EVENT_COLORS, EVENT_LABELS } from "@/lib/types";
import { courseColor } from "./CourseFilter";

// ── Types ─────────────────────────────────────────────────────────────────

interface CalendarViewProps {
  events:           CalendarEvent[];
  courses:          Course[];
  activeCourses:    Set<string>;
  unresolvedTopics: Record<string, string[]>;   // courseId → topic[]
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete:         (id: string) => void;
}

type ViewMode = "month" | "week";

// ── Helpers ───────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();   // 0 = Sunday
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Study Pulse computation ────────────────────────────────────────────────

/**
 * Returns a map of ISO date string → pulse intensity (0–1).
 * A day "pulses" if it's within 7 days before an EXAM that has at
 * least one unresolved error topic overlapping the exam's description.
 */
function computePulse(
  events: CalendarEvent[],
  unresolvedTopics: Record<string, string[]>
): Map<string, number> {
  const pulse = new Map<string, number>();

  const exams = events.filter(
    (ev) => ev.type === "EXAM" && ev.due_date && ev.due_date !== "TBD"
  );

  for (const exam of exams) {
    const unresolved = unresolvedTopics[exam.course_id] ?? [];
    if (unresolved.length === 0) continue;

    // Check overlap: any unresolved topic keyword appears in the exam title/description
    const examText = `${exam.title} ${exam.description}`.toLowerCase();
    const hasOverlap = unresolved.some((topic) =>
      topic.toLowerCase().split(" ").some((kw) => kw.length >= 4 && examText.includes(kw))
    );
    if (!hasOverlap && unresolved.length < 2) continue;  // show pulse even without direct match if 2+ errors

    const examDate = new Date(exam.due_date);
    for (let d = 7; d >= 1; d--) {
      const day = addDays(examDate, -d);
      const key = toIso(day);
      const intensity = (8 - d) / 8;   // 1/8 → 7/8 as we approach exam
      pulse.set(key, Math.max(pulse.get(key) ?? 0, intensity));
    }
  }

  return pulse;
}

// ── Event dot ────────────────────────────────────────────────────────────

function EventPill({
  event,
  courses,
  compact = false,
}: {
  event: CalendarEvent;
  courses: Course[];
  compact?: boolean;
}) {
  const courseIdx = courses.findIndex((c) => c.id === event.course_id);
  const cColor = courseColor(courseIdx >= 0 ? courseIdx : 0);
  const typeColor = EVENT_COLORS[event.type] ?? "#888";

  if (compact) {
    return (
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: typeColor }}
        title={event.title}
      />
    );
  }

  return (
    <div
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-full"
      style={{ background: typeColor + "22", color: typeColor, borderLeft: `2px solid ${typeColor}` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: cColor }}
        title={courses.find((c) => c.id === event.course_id)?.code}
      />
      <span className="truncate">{event.title}</span>
    </div>
  );
}

// ── Month Grid ───────────────────────────────────────────────────────────

function MonthGrid({
  year, month,
  events, courses, pulse,
  onSelectDay,
  selectedDay,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  courses: Course[];
  pulse: Map<string, number>;
  onSelectDay: (day: string) => void;
  selectedDay: string | null;
}) {
  const today   = toIso(new Date());
  const total   = daysInMonth(year, month);
  const offset  = firstDayOfMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      if (!ev.due_date || ev.due_date === "TBD") continue;
      const key = ev.due_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] text-white/30 uppercase tracking-widest font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="min-h-[80px] border-r border-b border-white/5" />;
          }

          const iso       = isoDate(year, month, day);
          const dayEvents = eventsByDate.get(iso) ?? [];
          const pIntensity = pulse.get(iso) ?? 0;
          const isToday   = iso === today;
          const isSelected = iso === selectedDay;

          return (
            <div
              key={iso}
              onClick={() => onSelectDay(iso)}
              className="min-h-[80px] border-r border-b border-white/5 p-1.5 cursor-pointer hover:bg-white/3 transition-colors relative"
              style={{
                background: pIntensity > 0
                  ? `rgba(239, 68, 68, ${pIntensity * 0.12})`
                  : isSelected ? "rgba(198,146,20,0.08)" : undefined,
                outline: isSelected ? "1px solid rgba(198,146,20,0.4)" : undefined,
              }}
            >
              {/* Study pulse glow */}
              {pIntensity > 0 && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ boxShadow: `inset 0 0 8px rgba(239,68,68,${pIntensity * 0.25})` }}
                />
              )}

              {/* Date number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full
                    ${isToday ? "bg-[#C69214] text-[#0F1D30]" : "text-white/60"}`}
                >
                  {day}
                </span>
                {pIntensity > 0.5 && (
                  <span className="text-[9px] text-red-400/60">⚠</span>
                )}
              </div>

              {/* Events — show up to 2 pills, rest as dots */}
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 2).map((ev) => (
                  <EventPill key={ev.id} event={ev} courses={courses} />
                ))}
                {dayEvents.length > 2 && (
                  <div className="flex gap-0.5 items-center pl-0.5">
                    {dayEvents.slice(2).map((ev) => (
                      <EventPill key={ev.id} event={ev} courses={courses} compact />
                    ))}
                    <span className="text-[9px] text-white/30">+{dayEvents.length - 2}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week Grid ────────────────────────────────────────────────────────────

function WeekGrid({
  weekStart,
  events, courses, pulse,
  onSelectDay, selectedDay,
}: {
  weekStart: Date;
  events: CalendarEvent[];
  courses: Course[];
  pulse: Map<string, number>;
  onSelectDay: (day: string) => void;
  selectedDay: string | null;
}) {
  const today = toIso(new Date());
  const days  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      if (!ev.due_date || ev.due_date === "TBD") continue;
      const key = ev.due_date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 gap-px bg-white/5 border-b border-white/10">
        {days.map((day) => {
          const iso        = toIso(day);
          const dayEvents  = eventsByDate.get(iso) ?? [];
          const pIntensity = pulse.get(iso) ?? 0;
          const isToday    = iso === today;
          const isSelected = iso === selectedDay;

          return (
            <div
              key={iso}
              onClick={() => onSelectDay(iso)}
              className="bg-[#0F1D30] p-2 min-h-[160px] cursor-pointer hover:bg-white/3 transition-colors"
              style={{
                background: pIntensity > 0
                  ? `rgba(239, 68, 68, ${pIntensity * 0.10})`
                  : isSelected ? "rgba(198,146,20,0.07)" : "#0F1D30",
              }}
            >
              {/* Day header */}
              <div className="flex items-center gap-1 mb-2">
                <span
                  className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? "bg-[#C69214] text-[#0F1D30]" : "text-white/70"}`}
                >
                  {day.getDate()}
                </span>
                <span className="text-[9px] text-white/30 uppercase">
                  {DAY_LABELS[day.getDay()]}
                </span>
              </div>

              {/* Events */}
              <div className="flex flex-col gap-1">
                {dayEvents.map((ev) => (
                  <EventPill key={ev.id} event={ev} courses={courses} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day Detail Panel ─────────────────────────────────────────────────────

function DayDetail({
  date, events, courses,
  onToggleComplete, onDelete, onClose,
}: {
  date: string;
  events: CalendarEvent[];
  courses: Course[];
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const dayEvents = events.filter((e) => e.due_date?.slice(0, 10) === date);

  return (
    <div className="w-72 flex-shrink-0 bg-[#182B49] border-l border-white/10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-white/70 text-sm font-semibold">{date}</span>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xs">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {dayEvents.length === 0 && (
          <p className="text-white/25 text-xs text-center mt-8">No events on this day</p>
        )}
        {dayEvents.map((ev) => {
          const tColor = EVENT_COLORS[ev.type] ?? "#888";
          const course = courses.find((c) => c.id === ev.course_id);
          return (
            <div
              key={ev.id}
              className="rounded-lg p-3 border"
              style={{ borderColor: tColor + "44", background: tColor + "0D" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{ev.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: tColor }}>
                    {EVENT_LABELS[ev.type]}
                    {ev.weight > 0 && <span className="text-white/40 ml-1">· {ev.weight}%</span>}
                  </p>
                  {course && (
                    <p className="text-[10px] text-white/30 mt-0.5">{course.code}</p>
                  )}
                  {ev.description && (
                    <p className="text-[10px] text-white/40 mt-1 line-clamp-2">{ev.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {ev.source !== "syllabus" && (
                    <>
                      <button
                        onClick={() => onToggleComplete(ev.id, !ev.completed)}
                        className="text-white/30 hover:text-emerald-400 transition-colors"
                      >
                        {ev.completed
                          ? <CheckCircle2 size={14} className="text-emerald-400" />
                          : <Circle size={14} />}
                      </button>
                      <button
                        onClick={() => onDelete(ev.id)}
                        className="text-white/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main CalendarView ────────────────────────────────────────────────────

export default function CalendarView({
  events, courses, activeCourses,
  unresolvedTopics,
  onToggleComplete, onDelete,
}: CalendarViewProps) {
  const today      = new Date();
  const [view,     setView]        = useState<ViewMode>("month");
  const [year,     setYear]        = useState(today.getFullYear());
  const [month,    setMonth]       = useState(today.getMonth());
  const [weekStart,setWeekStart]   = useState<Date>(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());   // go to Sunday
    return d;
  });
  const [selected, setSelected]    = useState<string | null>(null);

  // Filter by active courses
  const filtered = useMemo(
    () => events.filter((ev) => activeCourses.has(ev.course_id)),
    [events, activeCourses]
  );

  const pulse = useMemo(
    () => computePulse(filtered, unresolvedTopics),
    [filtered, unresolvedTopics]
  );

  // Navigation
  const prevPeriod = () => {
    if (view === "month") {
      if (month === 0) { setMonth(11); setYear((y) => y - 1); }
      else setMonth((m) => m - 1);
    } else {
      setWeekStart((ws) => addDays(ws, -7));
    }
  };

  const nextPeriod = () => {
    if (view === "month") {
      if (month === 11) { setMonth(0); setYear((y) => y + 1); }
      else setMonth((m) => m + 1);
    } else {
      setWeekStart((ws) => addDays(ws, 7));
    }
  };

  const periodLabel = view === "month"
    ? `${MONTHS[month]} ${year}`
    : `${toIso(weekStart)} – ${toIso(addDays(weekStart, 6))}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod} className="text-white/40 hover:text-white/80 transition-colors p-1">
            <ChevronLeft size={16} />
          </button>
          <span className="text-white/80 text-sm font-semibold min-w-[160px] text-center">
            {periodLabel}
          </span>
          <button onClick={nextPeriod} className="text-white/40 hover:text-white/80 transition-colors p-1">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Month / Week toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {(["month", "week"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-medium transition-colors"
              style={{
                background: view === v ? "rgba(198,146,20,0.15)" : "transparent",
                color:       view === v ? "#E8B84B" : "rgba(255,255,255,0.3)",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-white/5 shrink-0 flex-wrap">
        {(Object.entries(EVENT_COLORS) as [string, string][]).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1 text-[10px] text-white/40">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {EVENT_LABELS[type as keyof typeof EVENT_LABELS]}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] text-red-400/60 ml-2">
          <span className="w-2 h-2 rounded bg-red-500/30" />
          Study Pulse
        </span>
      </div>

      {/* Calendar + optional day detail */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {view === "month" ? (
            <MonthGrid
              year={year} month={month}
              events={filtered} courses={courses} pulse={pulse}
              selectedDay={selected} onSelectDay={setSelected}
            />
          ) : (
            <WeekGrid
              weekStart={weekStart}
              events={filtered} courses={courses} pulse={pulse}
              selectedDay={selected} onSelectDay={setSelected}
            />
          )}
        </div>

        {/* Day detail panel */}
        {selected && (
          <DayDetail
            date={selected}
            events={filtered}
            courses={courses}
            onToggleComplete={onToggleComplete}
            onDelete={onDelete}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}
