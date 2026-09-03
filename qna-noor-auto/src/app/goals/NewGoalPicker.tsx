"use client";

import { useState } from "react";
import { createGoal } from "./actions";
import { createRoutine } from "./routines/actions";
import { GoalForm } from "./GoalForm";
import { RoutineForm } from "./RoutineForm";

type NewGoalPickerProps = {
  accountType: string;
  features: string[];
  hasInvoices: boolean;
  today: string;
  goals: Array<{ id: string; title: string }>;
  users: Array<{ id: string; username: string }>;
};

export function NewGoalPicker({
  accountType,
  features,
  hasInvoices,
  today,
  goals,
  users,
}: NewGoalPickerProps) {
  const [mode, setMode] = useState<"number" | "routine" | "reminder">("number");
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {[
          ["number", "Reach a number"],
          ["routine", "Do something"],
          ["reminder", "Remind me"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value as typeof mode)}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              mode === value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {mode === "number" ? (
          <GoalForm
            action={createGoal}
            accountType={accountType}
            features={features}
            hasInvoices={hasInvoices}
            initial={{ startDate: today }}
          />
        ) : (
          <RoutineForm
            action={createRoutine}
            goals={goals}
            users={users}
            initial={mode === "reminder" ? { kind: "REMINDER" } : undefined}
            reminderOnly={mode === "reminder"}
            submitLabel={mode === "reminder" ? "Create reminder" : "Create"}
          />
        )}
      </div>
    </div>
  );
}
