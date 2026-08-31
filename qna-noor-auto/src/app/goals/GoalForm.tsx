"use client";

import { useState } from "react";
import { SaveButton } from "@/components/SaveButton";
import { Input, Select } from "@/components/ui";
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
  }>;
  accountType: string;
  hasInvoices: boolean;
  submitLabel?: string;
};

export function GoalForm({
  action,
  initial,
  accountType,
  hasInvoices,
  submitLabel = "Create goal",
}: GoalFormProps) {
  const [metric, setMetric] = useState(initial?.metric ?? "MONEY_IN");
  const [period, setPeriod] = useState(
    initial?.metric === "NET_SAVED" ? "BY_DATE" : initial?.period ?? "MONTH",
  );
  const repairNouns = repairOrderNouns(accountType);
  const autoShop = (accountType ?? "AUTO_SHOP") === "AUTO_SHOP";
  const metrics = [
    ["MONEY_IN", "Money in"],
    ["SPENDING", "Spending"],
    ["PROFIT", "Profit"],
    ["NET_SAVED", "Money saved"],
    ...(hasInvoices
      ? [["JOBS", autoShop ? "Jobs completed" : `${repairNouns.plural} completed`]]
      : []),
    ...(!hasInvoices ? [["UNITS_SOLD", "Units sold"]] : []),
    ["MANUAL", "I'll update this myself"],
  ];
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-700">
          Goal name
          <Input
            name="title"
            required
            defaultValue={initial?.title}
            placeholder="Bring in $5,000 this month"
            className="mt-1"
          />
        </label>
        <label className="block text-xs font-medium text-zinc-700">
          What to track
          <Select
            name="metric"
            value={metric}
            onChange={(event) => {
              const nextMetric = event.target.value;
              setMetric(nextMetric);
              if (nextMetric === "NET_SAVED") setPeriod("BY_DATE");
            }}
            className="mt-1"
          >
            {metrics.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-xs font-medium text-zinc-700">
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
        <label className="block text-xs font-medium text-zinc-700">
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
        {metric === "SPENDING" && (
          <label className="block text-xs font-medium text-zinc-700">
            Category (optional)
            <Input
              name="category"
              defaultValue={initial?.category ?? ""}
              placeholder="Supplies"
              className="mt-1"
            />
          </label>
        )}
        <label className="block text-xs font-medium text-zinc-700">
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
          <label className="block text-xs font-medium text-zinc-700">
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
          <label className="block text-xs font-medium text-zinc-700">
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
      <p className="text-xs text-zinc-500">
        Goals use the records already in your account automatically. Use the
        manual option for something you want to update yourself.
      </p>
      <SaveButton>{submitLabel}</SaveButton>
    </form>
  );
}
