"use client";

import { Field, Input, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import type { Technician } from "@prisma/client";
import { useState } from "react";

const TECHNICIAN_ROLES = [
  "Helper / Apprentice",
  "Lube technician",
  "General technician",
  "Master technician",
  "Diagnostic technician",
  "Supervisor / Foreman",
  "Service advisor",
  "Parts manager",
  "Shop manager",
  "Office manager",
  "Detailer",
];

export function TechForm({
  action,
  tech,
  submitLabel = "Save technician",
}: {
  action: (fd: FormData) => void | Promise<void>;
  tech?: Partial<Technician>;
  submitLabel?: string;
}) {
  const savedRole = tech?.role?.trim() ?? "";
  const isPresetRole = TECHNICIAN_ROLES.includes(savedRole);
  const [roleChoice, setRoleChoice] = useState(
    savedRole === "" ? "" : isPresetRole ? savedRole : "__OTHER__",
  );
  const [customRole, setCustomRole] = useState(isPresetRole ? "" : savedRole);

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name *">
          <Input
            name="name"
            required
            defaultValue={tech?.name ?? ""}
            placeholder="e.g. Carlos Rivera"
          />
        </Field>
        <Field label="Initials (shown on labor lines)">
          <Input
            name="initials"
            maxLength={4}
            defaultValue={tech?.initials ?? ""}
            placeholder="CR"
          />
        </Field>
      </div>

      <Field label="Role / title">
        <select
          name="role"
          value={roleChoice}
          onChange={(event) => setRoleChoice(event.target.value)}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        >
          <option value="">No role specified</option>
          {TECHNICIAN_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
          <option value="__OTHER__">Other (type a role)</option>
        </select>
        {roleChoice === "__OTHER__" && (
          <Input
            name="customRole"
            value={customRole}
            onChange={(event) => setCustomRole(event.target.value)}
            className="mt-2"
            placeholder="e.g. Warranty coordinator"
            autoComplete="off"
          />
        )}
      </Field>

      <Field label="Default labor rate ($/hr)">
        <Input
          name="defaultRate"
          inputMode="decimal"
          defaultValue={tech?.defaultRate ?? ""}
          placeholder="Leave blank to use shop default"
        />
      </Field>

      <Field label="Notes">
        <Textarea
          name="notes"
          rows={3}
          defaultValue={tech?.notes ?? ""}
          placeholder="Specialties, certifications, schedule notes, etc."
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={tech?.active ?? true}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Active (shown in tech dropdowns on repair orders)
      </label>

      <div className="flex gap-2">
        <SaveButton>{submitLabel}</SaveButton>
      </div>
    </form>
  );
}
