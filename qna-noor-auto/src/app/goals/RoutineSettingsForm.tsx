"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui";
import { ROUTINE_WEEKDAYS } from "@/lib/routines";

type RoutineSettingsFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  initial: {
    title: string;
    kind: string;
    dueTime: string | null;
    day: string | null;
    endDay: string | null;
    goalId: string | null;
    assigneeUserId: string | null;
    showStreak: boolean;
    weekdays: string | null;
  };
  goals: Array<{ id: string; title: string }>;
  users: Array<{ id: string; username: string }>;
};

export function RoutineSettingsForm({
  action,
  initial,
  goals,
  users,
}: RoutineSettingsFormProps) {
  const [kind, setKind] = useState(initial.kind);
  const oneOff = kind === "ONE_OFF" || kind === "REMINDER";

  return (
    <form action={action} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Name
          <Input
            name="title"
            required
            defaultValue={initial.title}
            className="mt-1"
          />
        </label>
        {users.length > 1 && (
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Assign to
            <Select
              name="assigneeUserId"
              defaultValue={initial.assigneeUserId ?? ""}
              className="mt-1"
            >
              <option value="">Anyone</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Schedule
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
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Default due time
          <Input
            name="dueTime"
            type="time"
            defaultValue={initial.dueTime ?? ""}
            className="mt-1"
          />
        </label>
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          One-off date
          <Input
            name="day"
            type="date"
            required={oneOff}
            defaultValue={initial.day ?? ""}
            className="mt-1"
          />
        </label>
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          End date
          <Input
            name="endDay"
            type="date"
            defaultValue={initial.endDay ?? ""}
            className="mt-1"
          />
        </label>
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Part of goal
          <Select
            name="goalId"
            defaultValue={initial.goalId ?? ""}
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
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          name="showStreak"
          value="on"
          defaultChecked={initial.showStreak}
        />
        Show streak
      </label>
      <fieldset>
        <legend className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Weekdays
        </legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {ROUTINE_WEEKDAYS.map(([value, label]) => (
            <label
              key={value}
              className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <input
                type="checkbox"
                name="weekdays"
                value={value}
                defaultChecked={(initial.weekdays ?? "")
                  .split(",")
                  .includes(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
        Save settings
      </button>
    </form>
  );
}
