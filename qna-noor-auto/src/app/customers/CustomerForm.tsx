import { Field, Input, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import type { Customer } from "@prisma/client";

export function CustomerForm({
  action,
  customer,
  submitLabel = "Save",
  defaultType,
}: {
  action: (fd: FormData) => void | Promise<void>;
  customer?: Partial<Customer>;
  submitLabel?: string;
  defaultType?: "INDIVIDUAL" | "BUSINESS";
}) {
  const type = customer?.type ?? defaultType ?? "INDIVIDUAL";
  return (
    <form action={action} className="space-y-6">
      <Field label="Customer type *">
        <div className="flex gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="INDIVIDUAL"
              defaultChecked={type === "INDIVIDUAL"}
            />
            Individual
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="BUSINESS"
              defaultChecked={type === "BUSINESS"}
            />
            Business
          </label>
        </div>
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name *">
          <Input name="firstName" required defaultValue={customer?.firstName ?? ""} />
        </Field>
        <Field label="Last name *">
          <Input name="lastName" required defaultValue={customer?.lastName ?? ""} />
        </Field>
        <Field label="Company name" className="md:col-span-2">
          <Input name="companyName" defaultValue={customer?.companyName ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={customer?.phone ?? ""} />
        </Field>
        <Field label="Alt phone">
          <Input name="altPhone" defaultValue={customer?.altPhone ?? ""} />
        </Field>
        <Field label="Email" className="md:col-span-2">
          <Input type="email" name="email" defaultValue={customer?.email ?? ""} />
        </Field>
        <Field label="Street" className="md:col-span-2">
          <Input name="street" defaultValue={customer?.street ?? ""} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={customer?.city ?? ""} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="State">
            <Input name="state" defaultValue={customer?.state ?? ""} />
          </Field>
          <Field label="ZIP">
            <Input name="zip" defaultValue={customer?.zip ?? ""} />
          </Field>
        </div>
        <Field label="Notes" className="md:col-span-2">
          <Textarea name="notes" rows={3} defaultValue={customer?.notes ?? ""} />
        </Field>
      </div>
      <div className="flex gap-2">
        <SaveButton>{submitLabel}</SaveButton>
      </div>
    </form>
  );
}
