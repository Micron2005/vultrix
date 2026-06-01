import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number | null | undefined): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(v);
}

/**
 * Parse a user-entered mileage value into an integer, tolerating commas,
 * spaces, and other separators (e.g. "123,456" or "123 456"). Returns null
 * when there are no digits.
 */
export function parseMileage(
  v: string | null | undefined,
): number | null {
  if (v == null) return null;
  const digits = String(v).replace(/[^\d]/g, "");
  if (digits === "") return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

/** Format a number of miles with thousands separators (e.g. 123456 -> "123,456"). */
export function formatMileage(n: number | null | undefined): string {
  if (typeof n !== "number" || !isFinite(n)) return "";
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function fullName(c: { firstName: string; lastName: string; companyName?: string | null }): string {
  if (c.companyName) return c.companyName;
  return `${c.firstName} ${c.lastName}`.trim();
}

export function vehicleLabel(v: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
}): string {
  const parts = [v.year, v.make, v.model, v.trim].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unknown Vehicle";
}
