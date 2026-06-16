import { Field, Input, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import type { Technician } from "@prisma/client";

export function TechForm({
  action,
  tech,
  submitLabel = "Save technician",
}: {
  action: (fd: FormData) => void | Promise<void>;
  tech?: Partial<Technician>;
  submitLabel?: string;
}) {
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
