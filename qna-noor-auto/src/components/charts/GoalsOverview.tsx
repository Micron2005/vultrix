"use client";

import Link from "next/link";
import { useState } from "react";
import { ChartSwitcher } from "./ChartSwitcher";
import type {
  GoalChartPoint,
  GoalChartSlice,
  GoalValueDescriptor,
} from "./GoalChart";

export type GoalDatasetView = {
  id: string;
  title: string;
  href: string | null;
  points: GoalChartPoint[];
  cumulative: GoalChartPoint[];
  pace: GoalChartPoint[];
  slices: GoalChartSlice[];
  descriptor: GoalValueDescriptor;
  emptyMessage: string;
};

export function GoalsOverview({
  datasets,
  combinedNote,
}: {
  datasets: GoalDatasetView[];
  combinedNote?: string;
}) {
  const [selected, setSelected] = useState(datasets[0]?.id ?? "combined");
  const dataset =
    datasets.find((entry) => entry.id === selected) ?? datasets[0];
  if (!dataset) return null;
  return (
    <>
      <ChartSwitcher
        points={dataset.points}
        cumulative={dataset.cumulative}
        pace={dataset.pace}
        slices={dataset.slices}
        valueLabel={dataset.descriptor}
        emptyMessage={dataset.emptyMessage}
        extra={
          <div className="flex items-center gap-3">
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              aria-label="Goal to chart"
              className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {datasets.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
            {dataset.href && (
              <Link
                href={dataset.href}
                className="text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              >
                Open goal
              </Link>
            )}
          </div>
        }
      />
      {combinedNote && dataset.id === "combined" && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {combinedNote}
        </p>
      )}
    </>
  );
}
