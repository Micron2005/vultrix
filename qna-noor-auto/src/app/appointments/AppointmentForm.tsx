import { Field, Input, Select, Textarea } from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import { fullName, vehicleLabel } from "@/lib/utils";
import type { Appointment, Customer, Vehicle } from "@prisma/client";
import { APPOINTMENT_STATUSES } from "./constants";
import { CustomerPicker } from "@/components/CustomerPicker";
import { formatInTimeZone, localCalendarDay } from "@/lib/timezone";

type CustomerWithVehicles = Customer & { vehicles: Vehicle[] };

export function AppointmentForm({
  action,
  appointment,
  customers,
  submitLabel = "Save",
  defaultCustomerId,
  defaultVehicleId,
  timezone,
}: {
  action: (fd: FormData) => void | Promise<void>;
  appointment?: Partial<Appointment>;
  customers: CustomerWithVehicles[];
  submitLabel?: string;
  defaultCustomerId?: string;
  defaultVehicleId?: string;
  timezone: string;
}) {
  const date = appointment?.startsAt
    ? toDateInputValue(appointment.startsAt, timezone)
    : todayInputValue(timezone);
  const time = appointment?.startsAt
    ? toTimeInputValue(appointment.startsAt, timezone)
    : "09:00";

  const selectedCustomerId =
    appointment?.customerId ?? defaultCustomerId ?? "";

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Customer *">
          <CustomerPicker
            customers={customers}
            defaultSelectedId={selectedCustomerId || undefined}
          />
        </Field>
        <Field label="Vehicle (optional)">
          <Select
            name="vehicleId"
            defaultValue={appointment?.vehicleId ?? defaultVehicleId ?? ""}
          >
            <option value="">— not yet assigned —</option>
            {/* Flatten all vehicles; group by customer for clarity */}
            {customers.flatMap((c) =>
              c.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {fullName(c)} — {vehicleLabel(v)}
                  {v.licensePlate ? ` (${v.licensePlate})` : ""}
                </option>
              )),
            )}
          </Select>
          <p className="mt-1 text-xs text-zinc-500">
            Leave blank if the vehicle isn&apos;t on file yet — you can assign it
            later.
          </p>
        </Field>

        <Field label="Date *">
          <Input type="date" name="date" required defaultValue={date} />
        </Field>
        <Field label="Time *">
          <Input type="time" name="time" required defaultValue={time} />
        </Field>

        <Field label="Duration (minutes)">
          <Input
            type="number"
            name="durationMinutes"
            min={5}
            step={5}
            defaultValue={appointment?.durationMinutes ?? 60}
          />
        </Field>
        <Field label="Status">
          <Select
            name="status"
            defaultValue={appointment?.status ?? "SCHEDULED"}
          >
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {prettyStatus(s)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Reason *" className="md:col-span-2">
          <Input
            name="reason"
            required
            defaultValue={appointment?.reason ?? ""}
            placeholder="e.g. Oil change, Brake inspection, Check engine light"
          />
        </Field>

        <Field label="Notes (internal)" className="md:col-span-2">
          <Textarea
            name="notes"
            rows={3}
            defaultValue={appointment?.notes ?? ""}
            placeholder="Anything you want to remember before the customer arrives."
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <SaveButton>{submitLabel}</SaveButton>
      </div>
    </form>
  );
}

export function prettyStatus(s: string): string {
  switch (s) {
    case "REQUESTED":
      return "Requested";
    case "SCHEDULED":
      return "Scheduled";
    case "CONFIRMED":
      return "Confirmed";
    case "ARRIVED":
      return "Arrived";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    case "NO_SHOW":
      return "No-show";
    default:
      return s;
  }
}

function toDateInputValue(d: Date | string, timezone: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return localCalendarDay(date, timezone);
}

function toTimeInputValue(d: Date | string, timezone: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return formatInTimeZone(date, timezone, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function todayInputValue(timezone: string): string {
  return localCalendarDay(new Date(), timezone);
}
