const TIME_ZONE_VALUES = new Set(Intl.supportedValuesOf("timeZone"));
const DEFAULT_TIME_ZONE = "America/New_York";

export function isValidTimeZone(timeZone: string): boolean {
  return TIME_ZONE_VALUES.has(timeZone);
}

export function formatInTimeZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE,
  }).format(date);
}

function safeTimeZone(timeZone: string): string {
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

export function localHour(date: Date, timeZone: string): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((value) => value.type === "hour");
  return Number(part?.value ?? 0);
}

export function localCalendarDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
