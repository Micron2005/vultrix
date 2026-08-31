import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { RECURRING_INTERVALS } from "@/lib/recurring";

type Line = {
  kind: string;
  description: string;
  quantity: number;
  unitPrice: number;
  partNumber: string | null;
};

export function RecurringInvoiceForm({
  action,
  customers,
  vehicles,
  initial,
}: {
  action: (fd: FormData) => void;
  customers: Array<{ id: string; firstName: string; lastName: string; companyName: string | null }>;
  vehicles: Array<{ id: string; customerId: string; year: number | null; make: string | null; model: string | null; unitNumber: string | null }>;
  initial?: {
    customerId?: string;
    vehicleId?: string | null;
    interval?: string;
    startDate?: Date;
    endDate?: Date | null;
    autoPost?: boolean;
    taxRate?: number;
    discount?: number;
    label?: string | null;
    notes?: string | null;
    lines?: Line[];
  };
}) {
  const lines = initial?.lines?.length
    ? initial.lines
    : [
        { kind: "LABOR", description: "", quantity: 1, unitPrice: 0, partNumber: null },
        { kind: "PART", description: "", quantity: 1, unitPrice: 0, partNumber: null },
        { kind: "FEE", description: "", quantity: 1, unitPrice: 0, partNumber: null },
      ];
  const dateValue = (date?: Date | null) =>
    date ? new Date(date).toISOString().slice(0, 10) : "";
  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Customer">
          <Select name="customerId" required defaultValue={initial?.customerId ?? ""}>
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.companyName || `${customer.firstName} ${customer.lastName}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vehicle (optional)">
          <Select name="vehicleId" defaultValue={initial?.vehicleId ?? ""}>
            <option value="">No vehicle</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.unitNumber || [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Series label">
          <Input name="label" defaultValue={initial?.label ?? ""} placeholder="Monthly fleet billing" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Field label="Repeats">
          <Select name="interval" defaultValue={initial?.interval ?? "MONTHLY"}>
            {RECURRING_INTERVALS.map((value) => (
              <option key={value} value={value}>
                {value === "BIWEEKLY" ? "Every 2 weeks" : value[0] + value.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Starts">
          <Input name="startDate" type="date" required defaultValue={dateValue(initial?.startDate)} />
        </Field>
        <Field label="Ends (optional)">
          <Input name="endDate" type="date" defaultValue={dateValue(initial?.endDate)} />
        </Field>
        <Field label="Tax rate (%)">
          <Input name="taxRate" type="number" step="0.01" min="0" defaultValue={initial?.taxRate ?? 0} />
        </Field>
        <Field label="Discount">
          <Input name="discount" type="number" step="0.01" min="0" defaultValue={initial?.discount ?? 0} />
        </Field>
      </div>
      <fieldset className="rounded-lg border border-zinc-200 p-4">
        <legend className="px-1 text-sm font-medium text-zinc-700">Issuing</legend>
        <label className="mr-5 inline-flex items-center gap-2 text-sm">
          <input type="radio" name="autoPost" value="true" defaultChecked={initial?.autoPost ?? true} />
          Issue automatically
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="radio" name="autoPost" value="false" defaultChecked={initial?.autoPost === false} />
          Hold for my review
        </label>
      </fieldset>
      <Field label="Notes">
        <Textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} />
      </Field>
      <Card>
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold">Invoice lines</div>
        <div className="divide-y divide-zinc-200">
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-5">
              <Select name="lineKind" defaultValue={line.kind}>
                <option value="LABOR">Labor</option>
                <option value="PART">Part</option>
                <option value="FEE">Fee</option>
              </Select>
              <Input name="lineDescription" placeholder="Description" defaultValue={line.description} />
              <Input name="lineQuantity" type="number" step="0.01" defaultValue={line.quantity} placeholder="Quantity / hours" />
              <Input name="lineUnitPrice" type="number" step="0.01" defaultValue={line.unitPrice} placeholder="Rate / amount" />
              <Input name="linePartNumber" defaultValue={line.partNumber ?? ""} placeholder="Part number (optional)" />
            </div>
          ))}
        </div>
      </Card>
      <Button type="submit">Save recurring invoice</Button>
    </form>
  );
}
