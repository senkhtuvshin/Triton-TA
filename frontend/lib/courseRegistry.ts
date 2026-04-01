/**
 * Course registry — persists the full course list to localStorage.
 *
 * All courses are treated identically; there are no protected built-ins.
 * DEFAULT_COURSES from types.ts is used only as the initial seed when
 * localStorage is empty for the first time.
 */
import { DEFAULT_COURSES, type Course } from "./types";

const STORAGE_KEY = "ucsd_agent_courses";

/** Load the full course list from localStorage, seeding with defaults if empty. */
export function loadCourses(): Course[] {
  if (typeof window === "undefined") return DEFAULT_COURSES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First visit — seed with defaults and persist them
      _persist(DEFAULT_COURSES);
      return DEFAULT_COURSES;
    }
    return JSON.parse(raw) as Course[];
  } catch {
    return DEFAULT_COURSES;
  }
}

/**
 * Add a new course and return the updated list.
 * Slug is derived from the course code: "CSE 105" → "cse_105".
 * If a course with that slug already exists the list is returned unchanged.
 */
export function addCourse(current: Course[], code: string, name: string): Course[] {
  const id = codeToId(code);
  if (current.some((c) => c.id === id)) return current;

  const updated = [...current, { id, code: code.toUpperCase(), name }];
  _persist(updated);
  return updated;
}

/**
 * Remove any course by id — including formerly-default courses.
 * Returns the updated list.
 */
export function removeCourse(current: Course[], id: string): Course[] {
  const updated = current.filter((c) => c.id !== id);
  _persist(updated);
  return updated;
}

/** Compute the slug that addCourse would generate for a given code. */
export function codeToId(code: string): string {
  return code
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function _persist(courses: Course[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}
