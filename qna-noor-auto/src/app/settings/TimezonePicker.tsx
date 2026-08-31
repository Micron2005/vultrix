"use client";

import { useEffect, useRef, useState } from "react";
import {
  allTimeZoneChoices,
  isValidTimeZone,
  searchTimeZones,
  zoneCurrentTime,
  type TimeZoneChoice,
} from "@/lib/timezones";

type TimezonePickerProps = {
  name: string;
  defaultValue: string;
};

const RESULTS_ID = "timezone-picker-results";

function choiceFor(
  choices: TimeZoneChoice[],
  id: string,
): TimeZoneChoice {
  return choices.find((choice) => choice.id === id) ?? {
    id,
    label: id.replaceAll("_", " "),
  };
}

export function TimezonePicker({
  name,
  defaultValue,
}: TimezonePickerProps) {
  const choices = allTimeZoneChoices();
  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [deviceZone, setDeviceZone] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedChoice = choiceFor(choices, selected);
  const results = now && open ? searchTimeZones(query, now, 12) : [];

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [selected]);

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimeZone(zone)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeviceZone(zone);
    }
  }, []);

  useEffect(() => {
    const handleOutsidePointer = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsidePointer);
    return () => document.removeEventListener("mousedown", handleOutsidePointer);
  }, []);

  function selectZone(zone: string) {
    setSelected(zone);
    setQuery("");
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length > 0) {
        setOpen(true);
        setHighlighted((current) => (current + 1) % results.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length > 0) {
        setOpen(true);
        setHighlighted(
          (current) => (current <= 0 ? results.length : current) - 1,
        );
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const result = results[highlighted];
      if (result) selectZone(result.id);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
      setOpen(false);
      setHighlighted(-1);
    }
  }

  const deviceCanBeUsed =
    deviceZone != null && isValidTimeZone(deviceZone) && deviceZone !== selected;

  return (
    <div ref={pickerRef} className="relative">
      <input type="hidden" name={name} value={selected} readOnly />
      <div className="mb-2 text-sm text-zinc-700">
        <span className="font-medium">{selectedChoice.label}</span>
        <span className="text-zinc-500"> · {selectedChoice.id}</span>
        <span className="text-zinc-500">
          {" "}
          · {now ? zoneCurrentTime(selected, now) : "—"}
        </span>
      </div>
      <input
        id={`${name}-search`}
        type="text"
        value={query}
        placeholder="Search a state, city, zone or time — e.g. Virginia, Eastern, 3:15 pm"
        role="combobox"
        aria-expanded={open}
        aria-controls={RESULTS_ID}
        aria-activedescendant={
          highlighted >= 0 && results[highlighted]
            ? `${RESULTS_ID}-${results[highlighted].id}`
            : undefined
        }
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 100);
        }}
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />
      {deviceCanBeUsed && (
        <button
          type="button"
          onClick={() => {
            if (deviceZone) selectZone(deviceZone);
          }}
          className="mt-2 text-left text-xs font-medium text-zinc-700 underline hover:text-zinc-900"
        >
          Use my device&apos;s timezone ({deviceZone})
        </button>
      )}
      {open && (results.length > 0 || Boolean(query.trim())) && (
        <div
          id={RESULTS_ID}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-zinc-600">
              No match for that. Try a state (Virginia), a nearby big city, or
              a time (3:15 pm).
            </div>
          ) : results.map((result, index) => (
            <div
              id={`${RESULTS_ID}-${result.id}`}
              key={result.id}
              role="option"
              aria-selected={result.id === selected}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectZone(result.id)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                index === highlighted
                  ? "bg-zinc-100"
                  : "hover:bg-zinc-50"
              } ${result.id === selected ? "bg-zinc-50" : ""}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-zinc-900">
                  {result.label}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {result.id}
                </span>
              </span>
              <span className="shrink-0 text-sm text-zinc-600">
                {now ? zoneCurrentTime(result.id, now) : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
