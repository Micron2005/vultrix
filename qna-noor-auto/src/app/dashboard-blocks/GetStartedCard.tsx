import Link from "next/link";
import { Card } from "@/components/ui";
import { dismissOnboarding } from "@/app/onboarding-actions";
import type { OnboardingStep } from "@/lib/onboarding";

export function GetStartedCard({
  steps,
  total,
  doneCount,
}: {
  steps: OnboardingStep[];
  total: number;
  doneCount: number;
}) {
  const progress = Math.round((doneCount / total) * 100);
  return (
    <Card className="mb-6">
      <div className="border-b border-zinc-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-900">Get started</h2>
            <span className="text-xs text-zinc-500">
              {doneCount} of {total}
            </span>
          </div>
          <form action={dismissOnboarding}>
            <button
              type="submit"
              className="text-xs font-medium text-zinc-500 underline hover:text-zinc-900"
            >
              Hide
            </button>
          </form>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-[var(--vx-accent-600)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="divide-y divide-zinc-100">
        {steps.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex gap-3 px-4 py-3 hover:bg-zinc-50"
          >
            <span
              className={
                item.done
                  ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--vx-accent-600)] text-xs text-white"
                  : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-transparent"
              }
              aria-hidden="true"
            >
              ✓
            </span>
            <span className={item.done ? "text-sm text-zinc-500" : "text-sm text-zinc-900"}>
              <span className={item.done ? "font-normal" : "font-semibold"}>{item.label}</span>
              {item.hint && <span className="mt-0.5 block text-xs text-zinc-500">{item.hint}</span>}
            </span>
          </Link>
        ))}
      </div>
      <p className="px-4 py-3 text-xs text-zinc-500">
        This disappears once everything&apos;s done. You can bring it back from Settings.
      </p>
    </Card>
  );
}
