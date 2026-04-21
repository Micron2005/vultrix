import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { createRepairOrder } from "../actions";
import { fullName, vehicleLabel } from "@/lib/utils";
import { CustomerPicker } from "@/components/CustomerPicker";

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

  // Step 2: pick vehicle if not provided
  if (!vehicleId) {
    if (customer.vehicles.length === 0) {
      redirect(`/vehicles/new?customerId=${customer.id}`);
    }

    async function pickVehicle(fd: FormData) {
      "use server";
      const v = fd.get("vehicleId");
      const c = fd.get("customerId");
      if (typeof v !== "string" || typeof c !== "string") return;
      redirect(`/repair-orders/new?customerId=${c}&vehicleId=${v}`);
    }

    return (
      <>
        <PageHeader
          title="New Repair Order"
          description={`Step 2: pick vehicle for ${fullName(customer)}`}
        />
        <Card className="p-6">
          <form action={pickVehicle} className="space-y-4 max-w-md">
            <input type="hidden" name="customerId" value={customer.id} />
            <Field label="Vehicle">
              <Select name="vehicleId" required defaultValue="">
                <option value="" disabled>
                  Select a vehicle…
                </option>
                {customer.vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleLabel(v)}
                    {v.licensePlate ? ` · ${v.licensePlate}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit">Continue</Button>
          </form>
        </Card>
      </>
    );
  }

  const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.customerId !== customer.id) notFound();

  return (
    <>
      <PageHeader
        title="New Repair Order"
        description={`${fullName(customer)} · ${vehicleLabel(vehicle)}`}
      />
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
