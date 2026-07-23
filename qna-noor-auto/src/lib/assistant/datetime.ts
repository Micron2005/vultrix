import * as chrono from "chrono-node";

/**
 * Context the assistant needs to resolve relative dates like "tomorrow at 9am".
 * `now` is the reference instant; `timezone` is an IANA name (e.g.
 * "America/New_York") sent by the client.
 */
export type DateContext = {
  timezone: string;
  now: Date;
};

export const DEFAULT_DATE_CONTEXT: DateContext = {
  timezone: "UTC",
  now: new Date(),
};

/**
 * Minutes east of UTC for an IANA timezone at a given instant (handles DST).
 * e.g. America/New_York in July -> -240.
 */
export function timezoneOffsetMinutes(timezone: string, at: Date): number {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(at);
    const map: Record<string, string> = {};
    for (const part of parts) map[part.type] = part.value;
    // Intl can emit hour "24" at midnight; normalize to 0.
    const hour = map.hour === "24" ? "00" : map.hour;
    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(hour),
      Number(map.minute),
      Number(map.second),
    );
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/**
 * A friendly, unambiguous description of "now" in the user's timezone, injected
 * into the system prompt so the model can resolve relative dates/times.
 */
export function describeNow(timezone: string, now: Date = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${fmt.format(now)} (timezone: ${timezone})`;
  } catch {
    return `${now.toUTCString()} (timezone: UTC)`;
  }
}

/**
 * Resolve a date/time expression to a concrete instant. Accepts ISO strings and
 * natural language ("tomorrow at 9am", "next Friday", "in 2 hours", "July 4").
 * Relative expressions resolve against `ctx.now` in `ctx.timezone`. Returns null
 * when nothing date-like can be found.
 */
export function parseDateTime(input: string, ctx: DateContext): Date | null {
  const text = input.trim();
  if (!text) return null;

  const reference: chrono.ParsingReference = {
    instant: ctx.now,
    timezone: timezoneOffsetMinutes(ctx.timezone, ctx.now),
  };

  try {
    const results = chrono.parse(text, reference, { forwardDate: true });
    if (results.length > 0) {
      const date = results[0].start.date();
      if (!Number.isNaN(date.getTime())) return date;
    }
  } catch {
    // fall through to native parsing
  }

  const native = new Date(text);
  return Number.isNaN(native.getTime()) ? null : native;
}
