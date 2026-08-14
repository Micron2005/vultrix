import Link from "next/link";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  href,
  highlight,
  sublines,
}: {
  label: ReactNode;
  value: string;
  href?: string;
  highlight?: boolean;
  sublines?: string[];
}) {
  const body = (
    <div
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
        {label}
      </div>
      <div
        className={
          "mt-2 text-2xl font-semibold " +
          (highlight ? "text-amber-900" : "text-zinc-900")
        }
      >
        {value}
      </div>
      {sublines && sublines.length > 0 && (
        <div
          className={
            "mt-2 space-y-0.5 text-xs " +
            (highlight ? "text-amber-800" : "text-zinc-500")
          }
        >
          {sublines.map((s, i) => (
            <div key={i}>{s}</div>
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
