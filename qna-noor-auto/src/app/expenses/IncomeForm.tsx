import { Field, Input, Select, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import {
  INCOME_FREQUENCIES,
  prettyFrequency,
} from "./categories";

function toDateInput(d: Date | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  return new Date(d).toISOString().slice(0, 10);
}

export function IncomeForm({
  action,
  initial,
}: {
  action: (fd: FormData) => void;
  initial?: {
    amount?: number;
    receivedAt?: Date;
    source?: string;
    frequency?: string;
    note?: string | null;
  };
}) {
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Date received (required)">
          <Input
            type="date"
            name="receivedAt"
            required
            defaultValue={toDateInput(initial?.receivedAt)}
          />
        </Field>
        <Field label="Amount (required)">
          <Input
            type="number"
            step="0.01"
            min="0.01"
            name="amount"
            required
            defaultValue={initial?.amount ?? ""}
            placeholder="0.00"
          />
        </Field>
        <Field label="Source (required)">
          <Input
            name="source"
            required
            defaultValue={initial?.source ?? ""}
            placeholder="Day job, Etsy, consulting…"
          />
        </Field>
      </div>
      <Field label="Frequency">
        <Select name="frequency" defaultValue={initial?.frequency ?? "ONE_TIME"}>
          {INCOME_FREQUENCIES.map((frequency) => (
            <option key={frequency} value={frequency}>
              {prettyFrequency(frequency)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Note">
        <Textarea
          name="note"
          rows={3}
          defaultValue={initial?.note ?? ""}
          placeholder="Anything worth remembering about this income"
        />
      </Field>
      <div className="flex gap-2 pt-2 border-t border-zinc-200">
        <SaveButton>Save income</SaveButton>
      </div>
    </form>
  );
}
