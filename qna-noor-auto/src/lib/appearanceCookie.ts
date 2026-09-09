import {
  normalizeAppearance,
  type AppearancePrefs,
} from "@/lib/appearance";

export const APPEARANCE_COOKIE = "vx-appearance";

export function readAppearanceCookie(
  value: string | undefined,
): AppearancePrefs | null {
  if (!value) return null;
  try {
    return normalizeAppearance(JSON.parse(value));
  } catch {
    return null;
  }
}

export function serializeAppearance(prefs: AppearancePrefs): string {
  return JSON.stringify(prefs);
}
