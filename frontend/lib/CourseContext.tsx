"use client";
import { createContext, useContext } from "react";
import type { Course } from "./types";
import { DEFAULT_COURSES } from "./types";

interface CourseContextValue {
  /** The active course's slug id, e.g. "math20c" or "cse_105". */
  courseId: string;
  /** Full ordered list of all courses (built-ins + user-added). */
  courses: Course[];
  /** The Course object for the active courseId, if it exists. */
  currentCourse: Course | undefined;
  /**
   * Increments each time an event is saved (manual add, draft confirm, etc.).
   * Widgets that fetch server data can watch this value and re-fetch when it changes.
   */
  refreshKey: number;
  /** Call this after any successful calendar-event write to notify all subscribers. */
  triggerRefresh: () => void;
}

export const CourseContext = createContext<CourseContextValue>({
  courseId:       "math20c",
  courses:        DEFAULT_COURSES,
  currentCourse:  DEFAULT_COURSES[0],
  refreshKey:     0,
  triggerRefresh: () => {},
});

/** Convenience hook — use anywhere inside the dashboard layout. */
export function useCourse(): CourseContextValue {
  return useContext(CourseContext);
}
