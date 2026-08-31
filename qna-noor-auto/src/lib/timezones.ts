export type TimeZoneChoice = {
  id: string;
  label: string;
};

export const US_STATE_ZONES: Record<string, string> = {
  Alabama: "America/Chicago",
  Alaska: "America/Anchorage",
  Arizona: "America/Phoenix",
  Arkansas: "America/Chicago",
  California: "America/Los_Angeles",
  Colorado: "America/Denver",
  Connecticut: "America/New_York",
  Delaware: "America/New_York",
  Florida: "America/New_York",
  Georgia: "America/New_York",
  Hawaii: "Pacific/Honolulu",
  Idaho: "America/Denver",
  Illinois: "America/Chicago",
  Indiana: "America/Indianapolis",
  Iowa: "America/Chicago",
  Kansas: "America/Chicago",
  Kentucky: "America/New_York",
  Louisiana: "America/Chicago",
  Maine: "America/New_York",
  Maryland: "America/New_York",
  Massachusetts: "America/New_York",
  Michigan: "America/Detroit",
  Minnesota: "America/Chicago",
  Mississippi: "America/Chicago",
  Missouri: "America/Chicago",
  Montana: "America/Denver",
  Nebraska: "America/Chicago",
  Nevada: "America/Los_Angeles",
  "New Hampshire": "America/New_York",
  "New Jersey": "America/New_York",
  "New Mexico": "America/Denver",
  "New York": "America/New_York",
  "North Carolina": "America/New_York",
  "North Dakota": "America/Chicago",
  Ohio: "America/New_York",
  Oklahoma: "America/Chicago",
  Oregon: "America/Los_Angeles",
  Pennsylvania: "America/New_York",
  "Rhode Island": "America/New_York",
  "South Carolina": "America/New_York",
  "South Dakota": "America/Chicago",
  Tennessee: "America/Chicago",
  Texas: "America/Chicago",
  Utah: "America/Denver",
  Vermont: "America/New_York",
  Virginia: "America/New_York",
  Washington: "America/Los_Angeles",
  "West Virginia": "America/New_York",
  Wisconsin: "America/Chicago",
  Wyoming: "America/Denver",
  "District of Columbia": "America/New_York",
};

const SECONDARY_STATE_ZONES: Record<string, string[]> = {
  Alaska: ["America/Adak"],
  Florida: ["America/Chicago"],
  Idaho: ["America/Los_Angeles"],
  Indiana: ["America/Indiana/Knox"],
  Kansas: ["America/Denver"],
  Kentucky: ["America/Chicago"],
  Michigan: ["America/Chicago"],
  Nebraska: ["America/Denver"],
  "North Dakota": ["America/Denver"],
  Oregon: ["America/Boise"],
  "South Dakota": ["America/Denver"],
  Tennessee: ["America/New_York"],
  Texas: ["America/Denver"],
};

const PRIMARY_ZONE_LABELS: Record<string, string> = {
  "America/New_York": "Eastern Time — New York",
  "America/Chicago": "Central Time — Chicago",
  "America/Denver": "Mountain Time — Denver",
  "America/Phoenix": "Mountain Time (no DST) — Phoenix",
  "America/Los_Angeles": "Pacific Time — Los Angeles",
  "America/Anchorage": "Alaska Time — Anchorage",
  "Pacific/Honolulu": "Hawaii Time — Honolulu",
};

export const PRIMARY_ZONES = Object.entries(PRIMARY_ZONE_LABELS).map(
  ([id, label]) => ({ id, label }),
);

const PRIMARY_ZONE_IDS = new Set(PRIMARY_ZONES.map((zone) => zone.id));
const SUPPORTED_ZONES = new Set(Intl.supportedValuesOf("timeZone"));
const ALIASES: Record<string, string[]> = {
  eastern: ["America/New_York"],
  et: ["America/New_York"],
  est: ["America/New_York"],
  edt: ["America/New_York"],
  central: ["America/Chicago"],
  ct: ["America/Chicago"],
  mountain: ["America/Denver", "America/Phoenix"],
  pacific: ["America/Los_Angeles"],
  pt: ["America/Los_Angeles"],
  alaska: ["America/Anchorage"],
  hawaii: ["Pacific/Honolulu"],
};

const STATE_ZONES_BY_ID = new Map<string, string[]>();
for (const [state, zone] of Object.entries(US_STATE_ZONES)) {
  STATE_ZONES_BY_ID.set(zone, [
    ...(STATE_ZONES_BY_ID.get(zone) ?? []),
    state,
  ]);
  for (const secondary of SECONDARY_STATE_ZONES[state] ?? []) {
    STATE_ZONES_BY_ID.set(secondary, [
      ...(STATE_ZONES_BY_ID.get(secondary) ?? []),
      state,
    ]);
  }
}

export function isValidTimeZone(id: string): boolean {
  return SUPPORTED_ZONES.has(id);
}

function derivedLabel(id: string): string {
  const parts = id.split("/");
  const region = parts[0] ?? id;
  const city = (parts.at(-1) ?? id).replaceAll("_", " ");
  return `${region} — ${city}`;
}

let cachedChoices: TimeZoneChoice[] | null = null;

export function allTimeZoneChoices(): TimeZoneChoice[] {
  if (cachedChoices) return cachedChoices;
  const rest = Intl.supportedValuesOf("timeZone")
    .filter((id) => !PRIMARY_ZONE_IDS.has(id))
    .map((id) => ({ id, label: derivedLabel(id) }));
  cachedChoices = [
    ...PRIMARY_ZONES.filter((zone) => SUPPORTED_ZONES.has(zone.id)),
    ...rest,
  ];
  return cachedChoices;
}

export function zoneAbbreviation(id: string, now: Date): string {
  if (!SUPPORTED_ZONES.has(id)) return "";
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: id,
    timeZoneName: "short",
  })
    .formatToParts(now)
    .find((value) => value.type === "timeZoneName");
  return part?.value ?? "";
}

export function zoneCurrentTime(id: string, now: Date): string {
  if (!SUPPORTED_ZONES.has(id)) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: id,
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
}

export function parseClockQuery(
  query: string,
): { hour24: number; minute: number } | null {
  const value = query.trim().toLowerCase();
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] == null ? 0 : Number(match[2]);
  const meridiem = match[3];
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    return {
      hour24: (hour % 12) + (meridiem === "pm" ? 12 : 0),
      minute,
    };
  }
  if (match[2] != null) {
    return hour <= 23 ? { hour24: hour, minute } : null;
  }
  return hour >= 1 && hour <= 12 ? { hour24: hour, minute } : null;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function localHourMinute(id: string, now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: id,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? -1),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? -1),
  };
}

export function searchTimeZones(
  query: string,
  now: Date,
  limit = 20,
): TimeZoneChoice[] {
  const choices = allTimeZoneChoices();
  const cappedLimit = Math.max(0, Math.floor(limit));
  if (cappedLimit === 0) return [];
  if (!query.trim()) return choices.slice(0, cappedLimit);

  const clock = parseClockQuery(query);
  if (clock) {
    const bareHour = /^\d{1,2}$/.test(query.trim());
    const hasMinute = /^\d{1,2}:\d{2}/.test(query.trim());
    const matches = choices.filter((choice) => {
      const current = localHourMinute(choice.id, now);
      const hours = bareHour
        ? [clock.hour24, (clock.hour24 + 12) % 24]
        : [clock.hour24];
      return (
        hours.includes(current.hour) &&
        (hasMinute ? current.minute === clock.minute : true)
      );
    });
    return matches.slice(0, cappedLimit);
  }

  const search = normalized(query);
  const scored = choices
    .map((choice, index) => {
      const idText = normalized(choice.id);
      const labelText = normalized(choice.label);
      const city = normalized(choice.id.split("/").at(-1) ?? "");
      const abbreviation = normalized(zoneAbbreviation(choice.id, now));
      const stateNames = (STATE_ZONES_BY_ID.get(choice.id) ?? []).map(normalized);
      const aliases = Object.entries(ALIASES)
        .filter(([, ids]) => ids.includes(choice.id))
        .map(([alias]) => alias);
      const exactStateOrAlias =
        stateNames.some((state) => state === search) ||
        aliases.some((alias) => alias === search);
      const labelPrefix = labelText.startsWith(search);
      const substring =
        labelText.includes(search) ||
        idText.includes(search) ||
        city.includes(search) ||
        abbreviation.includes(search) ||
        stateNames.some((state) => state.includes(search)) ||
        aliases.some((alias) => alias.includes(search));
      if (!substring) return null;
      const score =
        (exactStateOrAlias ? 300 : 0) +
        (labelPrefix ? 200 : 0) +
        (PRIMARY_ZONE_IDS.has(choice.id) ? 50 : 0) +
        (stateNames.some((state) => state === search) ? 20 : 0) -
        index / 10000;
      return { choice, score };
    })
    .filter((value): value is { choice: TimeZoneChoice; score: number } => value !== null)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, cappedLimit).map((value) => value.choice);
}
