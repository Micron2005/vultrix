"use client";

import { useState } from "react";
import { Input, Select, Textarea } from "@/components/ui";

type RoutineAction = (formData: FormData) => void | Promise<void>;

type RoutineFormProps = {
  action: RoutineAction;
  goals: Array<{ id: string; title: string }>;
  initial?: Partial<{
    title: string;
    kind: string;
    weekdays: string | null;
    day: string | null;
    dueTime: string | null;
    endDay: string | null;
    showStreak: boolean;
    goalId: string | null;
    items: string;
  }>;
  submitLabel?: string;
  reminderOnly?: boolean;
};

const weekdays = [
  ["0", "Sun"],
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
];

export function RoutineForm({
  action,
  goals,
  initial,
  submitLabel = "Create",
  reminderOnly = false,
}: RoutineFormProps) {
  const [kind, setKind] = useState(initial?.kind ?? "DAILY");
  const selectedDays = new Set((initial?.weekdays ?? "").split(","));
  const oneOff = kind === "ONE_OFF" || kind === "REMINDER";
  const repeating = !oneOff;
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Title
          <Input
            name="title"
            required
            defaultValue={initial?.title}
            placeholder={kind === "REMINDER" ? "Call the dentist" : "Morning reset"}
            className="mt-1"
          />
        </label>
        {!reminderOnly && (
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Type
            <Select
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="mt-1"
            >
              <option value="DAILY">Every day</option>
              <option value="WEEKDAYS">Selected weekdays</option>
              <option value="WEEKLY">Weekly</option>
              <option value="ONE_OFF">One time</option>
              <option value="REMINDER">Reminder</option>
            </Select>
          </label>
        )}
        {reminderOnly && <input type="hidden" name="kind" value="REMINDER" />}
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Due time (optional)
          <Input
            name="dueTime"
            type="time"
            defaultValue={initial?.dueTime ?? ""}
            className="mt-1"
          />
        </label>
        {oneOff && (
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Date
            <Input
              name="day"
              type="date"
              required={oneOff}
              defaultValue={initial?.day ?? ""}
              className="mt-1"
            />
          </label>
        )}
        {repeating && (
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            End date (optional)
            <Input
              name="endDay"
              type="date"
              defaultValue={initial?.endDay ?? ""}
              className="mt-1"
            />
          </label>
        )}
        {!reminderOnly && (
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Linked number goal (optional)
            <Select
              name="goalId"
              defaultValue={initial?.goalId ?? ""}
              className="mt-1"
            >
              <option value="">No linked goal</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>
      {kind === "WEEKDAYS" && (
        <fieldset>
          <legend className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Weekdays
          </legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {weekdays.map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                <input
                  type="checkbox"
                  name="weekdays"
                  value={value}
                  defaultChecked={
                    selectedDays.has(value) ||
                    (selectedDays.size === 0 && value !== "0" && value !== "6")
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {!reminderOnly && (
        <>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Things to do (one per line)
            <Textarea
              name="items"
              defaultValue={initial?.items ?? ""}
              placeholder="Drink water&#10;Go for a walk"
              className="mt-1"
              rows={4}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name="showStreak"
              value="on"
              defaultChecked={initial?.showStreak}
            />
            Show streak
          </label>
        </>
      )}
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {submitLabel}
      </button>
    </form>
  );
}
