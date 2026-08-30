import { Field, Input, Select, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import { RepeatFields } from "./RepeatFields";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS, prettyCategory, prettyMethod } from "./categories";

export function RecurringForm({
  action,
  kind,
  accountType,
  initial,
}: {
  action: (fd: FormData) => void;
  kind: "EXPENSE" | "INCOME";
  accountType?: string | null;
  initial?: {
    amount?: number;
    category?: string | null;
    vendor?: string | null;
    reference?: string | null;
    method?: string | null;
    source?: string | null;
    note?: string | null;
    interval?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    autoPost?: boolean;
  };
}) {
  const isAutoShop = accountType === "AUTO_SHOP";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Amount (required)">
          <Input type="number" step="0.01" min="0.01" name="amount" required defaultValue={initial?.amount ?? ""} />
        </Field>
        {kind === "EXPENSE" ? (
          <Field label="Category (required)">
            {isAutoShop ? (
              <Select name="category" defaultValue={initial?.category ?? "MISC"}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{prettyCategory(category)}</option>
                ))}
              </Select>
            ) : (
              <Input name="category" required defaultValue={initial?.category ?? ""} />
            )}
          </Field>
        ) : (
          <Field label="Source (required)">
            <Input name="source" required defaultValue={initial?.source ?? ""} />
          </Field>
        )}
        {kind === "EXPENSE" ? (
          <Field label="Vendor / payee">
            <Input name="vendor" defaultValue={initial?.vendor ?? ""} />
          </Field>
        ) : (
          <Field label="Note">
            <Input name="note" defaultValue={initial?.note ?? ""} />
          </Field>
        )}
      </div>
      {kind === "EXPENSE" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Reference / invoice #">
            <Input name="reference" defaultValue={initial?.reference ?? ""} />
          </Field>
          <Field label="Payment method">
            <Select name="method" defaultValue={initial?.method ?? ""}>
              <option value="">—</option>
              {EXPENSE_METHODS.map((method) => (
                <option key={method} value={method}>{prettyMethod(method)}</option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      {kind === "EXPENSE" && (
        <Field label="Note">
          <Textarea name="note" rows={3} defaultValue={initial?.note ?? ""} />
        </Field>
      )}
      <RepeatFields
        initialInterval={initial?.interval ?? "WEEKLY"}
        initialStartDate={initial?.startDate}
        initialEndDate={initial?.endDate}
        initialAutoPost={initial?.autoPost ?? true}
      />
      <div className="flex gap-2 border-t border-zinc-200 pt-2">
        <SaveButton>Save repeating entry</SaveButton>
      </div>
    </form>
  );
}
