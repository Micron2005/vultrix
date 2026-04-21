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

export function DuplicateROBanner({
  ros,
  heading,
  subheading,
}: {
  ros: OpenROSummary[];
  heading: string;
  subheading?: string;
}) {
  if (ros.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="font-semibold">{heading}</div>
      {subheading && (
        <div className="mt-0.5 text-xs text-amber-800">{subheading}</div>
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
                className="font-mono font-medium underline underline-offset-2 hover:text-amber-950"
              >
                RO #{ro.roNumber}
              </Link>
              <span className="text-amber-700">·</span>
              <span className="flex-1">
                <span className="font-medium">{statusLabel(ro.status)}</span>
                <span className="text-amber-700"> · {fmtDate(ro.openedAt)}</span>
                <div className="text-amber-900">{jobs}</div>
                {ro.matchedWords && ro.matchedWords.length > 0 && (
                  <div className="mt-0.5 text-xs text-amber-700">
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
