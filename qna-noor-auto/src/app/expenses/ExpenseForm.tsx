import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  prettyCategory,
  prettyMethod,
} from "./categories";

function toDateInput(d: Date | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const iso = new Date(d).toISOString();
  return iso.slice(0, 10);
}

export function ExpenseForm({
  action,
  initial,
}: {
  action: (fd: FormData) => void;
  initial?: {
    amount?: number;
    category?: string;
    paidAt?: Date;
    vendor?: string | null;
    reference?: string | null;
    method?: string | null;
    note?: string | null;
  };
}) {
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Date (required)">
          <Input
            type="date"
            name="paidAt"
            required
            defaultValue={toDateInput(initial?.paidAt)}
          />
        </Field>
        <Field label="Amount (required)">
          <Input
            type="number"
            step="0.01"
            name="amount"
            required
            defaultValue={initial?.amount ?? ""}
            placeholder="0.00"
          />
        </Field>
        <Field label="Category (required)">
          <Select name="category" defaultValue={initial?.category ?? "MISC"}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {prettyCategory(c)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Vendor / payee">
          <Input
            name="vendor"
            defaultValue={initial?.vendor ?? ""}
            placeholder="ComEd, NAPA, landlord…"
          />
        </Field>
        <Field label="Reference / invoice #">
          <Input
            name="reference"
            defaultValue={initial?.reference ?? ""}
            placeholder="check # / invoice #"
          />
        </Field>
        <Field label="Payment method">
          <Select name="method" defaultValue={initial?.method ?? ""}>
            <option value="">—</option>
            {EXPENSE_METHODS.map((m) => (
              <option key={m} value={m}>
                {prettyMethod(m)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Note">
        <Textarea
          name="note"
          rows={3}
          defaultValue={initial?.note ?? ""}
          placeholder="Anything worth remembering about this expense"
        />
      </Field>
      <div className="flex gap-2 pt-2 border-t border-zinc-200">
        <Button type="submit">Save expense</Button>
      </div>
    </form>
  );
}
