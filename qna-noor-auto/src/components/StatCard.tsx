import Link from "next/link";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  href,
  highlight,
  sublines,
  reportStat = false,
}: {
  label: ReactNode;
  value: string;
  href?: string;
  highlight?: boolean;
  sublines?: string[];
  reportStat?: boolean;
}) {
  const body = (
    <div
      data-report-stat={reportStat ? true : undefined}
      className={
        "rounded-lg border p-4 shadow-sm " +
        (highlight
          ? "border-amber-200 bg-amber-50"
          : "border-zinc-200 bg-white")
      }
    >
      <div
        className={
          "text-xs font-medium uppercase tracking-wider " +
          (highlight ? "text-amber-800" : "text-zinc-500")
        }
      >
        <span data-report-stat-label={reportStat ? true : undefined}>{label}</span>
      </div>
      <div
        className={
          "mt-2 text-2xl font-semibold " +
          (highlight ? "text-amber-900" : "text-zinc-900")
        }
      >
        <span data-report-stat-value={reportStat ? true : undefined}>{value}</span>
      </div>
      {sublines && sublines.length > 0 && (
        <div
          className={
            "mt-2 space-y-0.5 text-xs " +
            (highlight ? "text-amber-800" : "text-zinc-500")
          }
        >
          {sublines.map((s, i) => (
            <div key={i} data-report-stat-subline={reportStat ? true : undefined}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
  if (href)
    return (
      <Link href={href} className="block transition-shadow hover:shadow-md">
        {body}
      </Link>
    );
  return body;
}
