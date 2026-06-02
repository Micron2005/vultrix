import Link from "next/link";
import type { OpenROSummary } from "@/lib/duplicates";

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const TONES = {
  warning: {
    box: "border-amber-300 bg-amber-50 text-amber-900",
    sub: "text-amber-800",
    sep: "text-amber-700",
    link: "hover:text-amber-950",
    meta: "text-amber-700",
    body: "text-amber-900",
  },
  info: {
    box: "border-zinc-300 bg-zinc-50 text-zinc-800",
    sub: "text-zinc-600",
    sep: "text-zinc-400",
    link: "hover:text-zinc-950",
    meta: "text-zinc-500",
    body: "text-zinc-700",
  },
} as const;

export function DuplicateROBanner({
  ros,
  heading,
  subheading,
  tone = "warning",
}: {
  ros: OpenROSummary[];
  heading: string;
  subheading?: string;
  tone?: "warning" | "info";
}) {
  if (ros.length === 0) return null;
  const t = TONES[tone];
  return (
    <div className={`rounded-lg border p-4 text-sm ${t.box}`}>
      <div className="font-semibold">{heading}</div>
      {subheading && (
        <div className={`mt-0.5 text-xs ${t.sub}`}>{subheading}</div>
      )}
      <ul className="mt-2 space-y-1">
        {ros.map((ro) => {
          const jobs = ro.laborDescriptions.length
            ? ro.laborDescriptions.slice(0, 3).join(" · ") +
              (ro.laborDescriptions.length > 3
                ? ` · +${ro.laborDescriptions.length - 3} more`
                : "")
            : ro.complaint?.trim()
              ? ro.complaint
              : "(no labor lines yet)";
          return (
            <li key={ro.id} className="flex items-start gap-2">
              <Link
                href={`/repair-orders/${ro.id}`}
                className={`font-mono font-medium underline underline-offset-2 ${t.link}`}
              >
                RO #{ro.roNumber}
              </Link>
              <span className={t.sep}>·</span>
              <span className="flex-1">
                <span className="font-medium">{statusLabel(ro.status)}</span>
                <span className={t.meta}> · {fmtDate(ro.openedAt)}</span>
                <div className={t.body}>{jobs}</div>
                {ro.matchedWords && ro.matchedWords.length > 0 && (
                  <div className={`mt-0.5 text-xs ${t.meta}`}>
                    Matches on: {ro.matchedWords.join(", ")}
                  </div>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
