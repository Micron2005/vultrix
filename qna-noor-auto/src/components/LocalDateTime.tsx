"use client";

import { useEffect, useState } from "react";

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/**
 * Render an absolute timestamp in the viewer's local timezone. Server-rendered
 * pages run in UTC, so formatting a time-of-day there is wrong for anyone not
 * in UTC; this defers formatting to the client. Renders a stable placeholder
 * on the server / first paint, then fills in the local time after mount.
 */
export function LocalDateTime({
  value,
}: {
  value: Date | string | number | null | undefined;
}) {
  const iso =
    value == null
      ? null
      : (value instanceof Date ? value : new Date(value)).toISOString();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setText(iso ? fmt(new Date(iso)) : "—");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [iso]);
  return <span suppressHydrationWarning>{text ?? (iso ? "…" : "—")}</span>;
}
