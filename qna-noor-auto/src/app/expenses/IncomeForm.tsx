import { Field, Input, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import { RepeatFields } from "./RepeatFields";

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
    startDate?: Date | null;
    endDate?: Date | null;
    autoPost?: boolean;
    recurringId?: string | null;
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
      <Field label="Note">
        <Textarea
          name="note"
          rows={3}
          defaultValue={initial?.note ?? ""}
          placeholder="Anything worth remembering about this income"
        />
      </Field>
      {initial?.recurringId ? (
        <p className="border-t border-zinc-200 pt-4 text-sm text-zinc-600">
          This income is part of a repeating entry.{" "}
          <a
            href={`/expenses/recurring/${initial.recurringId}/edit`}
            className="font-medium text-zinc-900 underline"
          >
            Edit the repeating entry
          </a>
          .
        </p>
      ) : (
        <RepeatFields
          initialInterval={initial?.frequency}
          initialStartDate={initial?.startDate ?? initial?.receivedAt}
          initialEndDate={initial?.endDate}
          initialAutoPost={initial?.autoPost}
        />
      )}
      <div className="flex gap-2 pt-2 border-t border-zinc-200">
        <SaveButton>Save income</SaveButton>
      </div>
    </form>
  );
}
