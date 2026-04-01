import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(isoDate: string): string {
  // Parse as local date by splitting the ISO string, avoiding the UTC-midnight
  // pitfall where new Date("2026-04-21") renders as Apr 20 in US timezones.
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function urgencyColor(urgency: "critical" | "high" | "medium" | "low"): string {
  // Dark-mode palette — legible on the navy #0F1D30 sidebar background.
  return {
    critical: "text-red-300   bg-red-950/50   border-red-700/60",
    high:     "text-orange-300 bg-orange-950/50 border-orange-700/60",
    medium:   "text-amber-300  bg-amber-950/50  border-amber-700/60",
    low:      "text-emerald-300 bg-emerald-950/50 border-emerald-700/60",
  }[urgency];
}

export function urgencyDotColor(urgency: "critical" | "high" | "medium" | "low"): string {
  return {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
  }[urgency];
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}
