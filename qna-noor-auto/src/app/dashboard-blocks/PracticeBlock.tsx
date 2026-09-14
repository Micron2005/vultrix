import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";
import { loadPracticeWeekSummary } from "@/lib/practice";

export async function PracticeBlock({
  orgId,
  timezone,
  title,
}: {
  orgId: string;
  timezone: string;
  title?: string;
}) {
  const summary = await loadPracticeWeekSummary(orgId, timezone);
  return (
    <Card className="mb-6">
      <CardHeader title={title ?? "Practice this week"} />
      <div className="flex items-end justify-between gap-4 p-4">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-zinc-500">Minutes</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.totalMinutes}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Streak</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.currentStreak}<span className="ml-1 text-xs font-normal text-zinc-500">days</span></p>
          </div>
        </div>
        <Link href="/songs/practice" className="text-sm font-medium text-[var(--vx-accent-700)] hover:underline">Open practice →</Link>
      </div>
    </Card>
  );
}
