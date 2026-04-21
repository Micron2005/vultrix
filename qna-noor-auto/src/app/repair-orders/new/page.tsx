import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { createRepairOrder } from "../actions";
import { fullName, vehicleLabel } from "@/lib/utils";
import { CustomerPicker } from "@/components/CustomerPicker";
import { openROsForVehicle } from "@/lib/duplicates";
import { DuplicateROBanner } from "@/components/DuplicateROBanner";
import { VehiclePickerOrCreate } from "./VehiclePickerOrCreate";

export const dynamic = "force-dynamic";

export default async function NewRepairOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string }>;
}) {
  const { customerId: cIdFromQuery, vehicleId: vIdFromQuery } =
    await searchParams;

  // If vehicleId provided, derive customer from vehicle
  let customerId = cIdFromQuery ?? undefined;
  const vehicleId = vIdFromQuery ?? undefined;

  if (vehicleId && !customerId) {
    const v = await db.vehicle.findUnique({
      where: { id: vehicleId },
      select: { customerId: true },
    });
    if (!v) notFound();
    customerId = v.customerId;
  }

  // Step 1: pick customer
  if (!customerId) {
    const customers = await db.customer.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        type: true,
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        email: true,
      },
      take: 2000,
    });
    if (customers.length === 0) redirect("/customers/new");

    async function pickCustomer(fd: FormData) {
      "use server";
      const id = fd.get("customerId");
      if (typeof id !== "string" || !id) return;
      redirect(`/repair-orders/new?customerId=${id}`);
    }

    return (
      <>
        <PageHeader title="New Repair Order" description="Step 1: pick customer" />
        <Card className="p-6">
          <form action={pickCustomer} className="space-y-4 max-w-md">
            <Field label="Customer">
              <CustomerPicker customers={customers} />
            </Field>
            <Button type="submit">Continue</Button>
          </form>
        </Card>
      </>
    );
  }

  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: { vehicles: { orderBy: { createdAt: "desc" } } },
  });
  if (!customer) notFound();

  // Step 2: pick vehicle if not provided — OR inline-create one
  if (!vehicleId) {
    async function pickOrCreateVehicle(fd: FormData) {
      "use server";
      const c = fd.get("customerId");
      if (typeof c !== "string" || !c) return;
      const mode = fd.get("mode");

      if (mode === "existing") {
        const v = fd.get("vehicleId");
        if (typeof v !== "string" || !v) return;
        redirect(`/repair-orders/new?customerId=${c}&vehicleId=${v}`);
      }

      // Inline create new vehicle
      const get = (k: string) => {
        const v = fd.get(k);
        return typeof v === "string" && v.trim() ? v.trim() : null;
      };
      const yearStr = get("year");
      const mileageStr = get("mileage");
      const plate = get("licensePlate");
      const state = get("licenseState");
      const created = await db.vehicle.create({
        data: {
          customerId: c,
          vin: get("vin")?.toUpperCase() ?? null,
          year: yearStr ? parseInt(yearStr, 10) || null : null,
          make: get("make"),
          model: get("model"),
          trim: get("trim"),
          engine: get("engine"),
          color: get("color"),
          licensePlate: plate ? plate.toUpperCase() : null,
          licenseState: state ? state.toUpperCase() : null,
          mileage: mileageStr ? parseInt(mileageStr, 10) || null : null,
        },
      });
      redirect(`/repair-orders/new?customerId=${c}&vehicleId=${created.id}`);
    }

    const vehicles = customer.vehicles.map((v) => ({
      id: v.id,
      label: `${vehicleLabel(v)}${v.licensePlate ? ` · ${v.licensePlate}` : ""}`,
    }));

    return (
      <>
        <PageHeader
          title="New Repair Order"
          description={`Step 2: pick or add vehicle for ${fullName(customer)}`}
        />
        <Card className="p-6">
          <VehiclePickerOrCreate
            customerId={customer.id}
            action={pickOrCreateVehicle}
            vehicles={vehicles}
          />
        </Card>
      </>
    );
  }

  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.customerId !== customer.id) notFound();

  const openROs = await openROsForVehicle(vehicle.id);

  return (
    <>
      <PageHeader
        title="New Repair Order"
        description={`${fullName(customer)} · ${vehicleLabel(vehicle)}`}
      />
      {openROs.length > 0 && (
        <div className="mb-4">
          <DuplicateROBanner
            ros={openROs}
            heading={`This vehicle already has ${openROs.length} open repair order${openROs.length === 1 ? "" : "s"}`}
            subheading="Review before creating a new one — if it's a different job, continue as normal."
          />
        </div>
      )}
      <Card className="p-6">
        <form action={createRepairOrder} className="space-y-4 max-w-2xl">
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="vehicleId" value={vehicle.id} />
          <Field label="Customer complaint">
            <Textarea
              name="complaint"
              rows={3}
              placeholder="What did the customer say? (e.g. 'Engine making a clicking noise on cold start')"
            />
          </Field>
          <Field label="Mileage in">
            <Input
              name="mileageIn"
              inputMode="numeric"
              defaultValue={vehicle.mileage?.toString() ?? ""}
            />
          </Field>
          <Button type="submit">Create Repair Order</Button>
        </form>
      </Card>
    </>
  );
}
