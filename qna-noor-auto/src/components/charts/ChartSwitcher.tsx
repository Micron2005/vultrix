"use client";

import { useState } from "react";
import {
  GoalChart,
  type GoalChartKind,
  type GoalChartPoint,
  type GoalChartSlice,
  type GoalValueDescriptor,
} from "./GoalChart";

type ChartSwitcherProps = {
  points: GoalChartPoint[];
  cumulative: GoalChartPoint[];
  pace: GoalChartPoint[];
  slices: GoalChartSlice[];
  valueLabel: GoalValueDescriptor;
  emptyMessage: string;
  extra?: React.ReactNode;
};

export function ChartSwitcher({
  points,
  cumulative,
  pace,
  slices,
  valueLabel,
  emptyMessage,
  extra,
}: ChartSwitcherProps) {
  const [kind, setKind] = useState<GoalChartKind>("line");
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
          {(["line", "bar", "pie"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              className={`rounded px-3 py-1.5 text-xs font-medium capitalize ${
                kind === option
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        {extra}
      </div>
      <GoalChart
        kind={kind}
        points={points}
        cumulative={cumulative}
        pace={pace}
        slices={slices}
        valueLabel={valueLabel}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
