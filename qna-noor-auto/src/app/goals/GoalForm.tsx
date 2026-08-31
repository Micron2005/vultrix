"use client";

import { useState } from "react";
import { SaveButton } from "@/components/SaveButton";
import { Input, Select } from "@/components/ui";
import { metricAllowed } from "@/lib/goalAvailability";
import { repairOrderNouns } from "@/lib/features";

type GoalAction = (formData: FormData) => void | Promise<void>;

type GoalFormProps = {
  action: GoalAction;
  initial?: Partial<{
    title: string;
    metric: string;
    target: number;
    period: string;
    category: string | null;
    startDate: string;
    dueDate: string;
    manualProgress: number | null;
    direction: string;
    unit: string | null;
  }>;
  accountType: string;
  features: string[];
  hasInvoices: boolean;
  submitLabel?: string;
};

export function GoalForm({
  action,
  initial,
  accountType,
  features,
  hasInvoices,
  submitLabel = "Create goal",
}: GoalFormProps) {
  const defaultMetric =
    initial?.metric ??
    (features.includes("financials") ? "MONEY_IN" : "HABIT");
  const [metric, setMetric] = useState(defaultMetric);
  const [direction, setDirection] = useState(initial?.direction ?? "AT_LEAST");
  const [period, setPeriod] = useState(
    initial?.metric === "NET_SAVED" ? "BY_DATE" : initial?.period ?? "MONTH",
  );
  const repairNouns = repairOrderNouns(accountType);
  const autoShop = (accountType ?? "AUTO_SHOP") === "AUTO_SHOP";
  const labels: Record<string, string> = {
    MONEY_IN: "Money in",
    SPENDING: "Spending",
    PROFIT: "Profit",
    NET_SAVED: "Money saved",
    JOBS: autoShop ? "Jobs completed" : `${repairNouns.plural} completed`,
    UNITS_SOLD: "Units sold",
    HABIT: "Something I do — I'll check it off",
    LOGGED_TOTAL: "A number I add up (miles, hours, pages)",
    LOGGED_LATEST: "A number I track (weight, savings balance)",
    EVENTS: hasInvoices ? "Appointments booked" : "Calendar events",
    NOTES_WRITTEN: "Notes written",
    MANUAL: "I'll update this myself",
  };
  const metrics = Object.keys(labels).filter((value) =>
    metricAllowed(value, { accountType, features }),
  );
  const directionChoice =
    metric === "LOGGED_TOTAL" || metric === "LOGGED_LATEST";
  const unitChoice =
    metric === "HABIT" ||
    metric === "LOGGED_TOTAL" ||
    metric === "LOGGED_LATEST" ||
    metric === "MANUAL";

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Goal name
          <Input
            name="title"
            required
            defaultValue={initial?.title}
            placeholder="Bring in $5,000 this month"
            className="mt-1"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          What to track
          <Select
            name="metric"
            value={metric}
            onChange={(event) => {
              const nextMetric = event.target.value;
              setMetric(nextMetric);
              setDirection("AT_LEAST");
              if (nextMetric === "NET_SAVED") setPeriod("BY_DATE");
            }}
            className="mt-1"
          >
            {metrics.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Target
          <Input
            name="target"
            required
            defaultValue={initial?.target}
            inputMode="decimal"
            placeholder={metric === "MANUAL" ? "12" : "$5,000"}
            className="mt-1"
          />
        </label>
        {directionChoice && (
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Direction
            <Select
              name="direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              className="mt-1"
            >
              <option value="AT_LEAST">Reach at least</option>
              <option value="AT_MOST">Stay under</option>
            </Select>
          </label>
        )}
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Timeframe
          <Select
            name="period"
            value={period}
            disabled={metric === "NET_SAVED"}
            onChange={(event) => setPeriod(event.target.value)}
            className="mt-1"
          >
            {metric !== "NET_SAVED" && <option value="WEEK">This week</option>}
            {metric !== "NET_SAVED" && <option value="MONTH">This month</option>}
            {metric !== "NET_SAVED" && <option value="YEAR">This year</option>}
            <option value="BY_DATE">By a date</option>
          </Select>
          {metric === "NET_SAVED" && (
            <input type="hidden" name="period" value="BY_DATE" />
          )}
        </label>
        {unitChoice && (
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Unit (optional)
            <Input
              name="unit"
              defaultValue={initial?.unit ?? ""}
              placeholder={metric === "HABIT" ? "days" : "miles"}
              className="mt-1"
            />
          </label>
        )}
        {metric === "SPENDING" && (
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Category (optional)
            <Input
              name="category"
              defaultValue={initial?.category ?? ""}
              placeholder="Supplies"
              className="mt-1"
            />
          </label>
        )}
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Starts
          <Input
            name="startDate"
            type="date"
            required
            defaultValue={initial?.startDate}
            className="mt-1"
          />
        </label>
        {period === "BY_DATE" && (
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Due date
            <Input
              name="dueDate"
              type="date"
              required
              defaultValue={initial?.dueDate}
              className="mt-1"
            />
          </label>
        )}
        {metric === "MANUAL" && (
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Current progress (optional)
            <Input
              name="manualProgress"
              defaultValue={initial?.manualProgress ?? ""}
              inputMode="decimal"
              placeholder="0"
              className="mt-1"
            />
          </label>
        )}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Goals use the records already in your account automatically. Use the
        manual option for something you want to update yourself.
      </p>
      <SaveButton>{submitLabel}</SaveButton>
    </form>
  );
}
