import type { SavedRoiReading } from "./types";

const STORAGE_KEY = "spherex_saved_roi_readings_v1";
const MAX_SAVED_READINGS = 100;

export function loadSavedRoiReadings(): SavedRoiReading[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedRoiReading[]) : [];
  } catch {
    return [];
  }
}

export function saveRoiReading(reading: SavedRoiReading): SavedRoiReading[] {
  const current = loadSavedRoiReadings().filter((r) => r.id !== reading.id);
  const next = [reading, ...current].slice(0, MAX_SAVED_READINGS);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function deleteRoiReading(id: string): SavedRoiReading[] {
  const next = loadSavedRoiReadings().filter((r) => r.id !== id);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}
