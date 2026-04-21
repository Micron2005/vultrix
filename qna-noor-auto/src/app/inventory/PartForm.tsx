import { Button, Field, Input, Textarea } from "@/components/ui";
import type { Part } from "@prisma/client";

export function PartForm({
  action,
  part,
  submitLabel = "Save part",
  isNew = false,
}: {
  action: (fd: FormData) => void | Promise<void>;
  part?: Partial<Part>;
  submitLabel?: string;
  isNew?: boolean;
}) {
  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name *">
          <Input
            name="name"
            required
            defaultValue={part?.name ?? ""}
            placeholder="e.g. Front brake pad set (ceramic)"
          />
        </Field>
        <Field label="Part number">
          <Input
            name="partNumber"
            defaultValue={part?.partNumber ?? ""}
            placeholder="BP-HD-4352"
          />
        </Field>
      </div>

      <Field label="Description">
        <Textarea
          name="description"
          rows={2}
          defaultValue={part?.description ?? ""}
          placeholder="Fitment, grade, size, etc."
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Default supplier">
          <Input
            name="source"
            defaultValue={part?.source ?? ""}
            placeholder="NAPA, AutoZone, dealer…"
          />
        </Field>
        <Field label="Cost ($)">
          <Input
            name="costPrice"
            inputMode="decimal"
            defaultValue={part?.costPrice ?? ""}
            placeholder="What you pay"
          />
        </Field>
        <Field label="Price ($)">
          <Input
            name="unitPrice"
            inputMode="decimal"
            defaultValue={part?.unitPrice ?? ""}
            placeholder="What you charge"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label={isNew ? "Opening quantity on hand" : "Quantity on hand (managed via stock moves)"}>
          <Input
            name="qtyOnHand"
            inputMode="decimal"
            defaultValue={part?.qtyOnHand ?? (isNew ? "0" : "")}
            disabled={!isNew}
            placeholder="0"
          />
        </Field>
        <Field label="Reorder threshold (low-stock warning at or below)">
          <Input
            name="reorderLevel"
            inputMode="decimal"
            defaultValue={part?.reorderLevel ?? "0"}
            placeholder="0"
          />
        </Field>
      </div>

      <Field label="Notes">
        <Textarea
          name="notes"
          rows={3}
          defaultValue={part?.notes ?? ""}
          placeholder="Fitment notes, alternate part numbers, storage location, etc."
        />
      </Field>

      {!isNew && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="archived"
            defaultChecked={part?.archived ?? false}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Archived (hide from catalog dropdowns — preserves historical RO lines)
        </label>
      )}

      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
