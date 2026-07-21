import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgId, requireUser } from "@/lib/session";
import {
  Button,
  Card,
  Field,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { MileageInput } from "@/components/MileageInput";
import { createRepairOrder } from "../actions";
import { fullName, parseMileage, vehicleLabel } from "@/lib/utils";
import { openROsForVehicle, pastROsForVehicle } from "@/lib/duplicates";
import { DuplicateROBanner } from "@/components/DuplicateROBanner";
import { VehiclePickerOrCreate } from "./VehiclePickerOrCreate";
import { CustomerPickerOrCreate } from "./CustomerPickerOrCreate";

export const dynamic = "force-dynamic";

export default async function NewRepairOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string }>;
}) {
  const user = await requireUser();
  const orgId = await requireOrgId();
  const isAutoShop = (user.accountType ?? "AUTO_SHOP") === "AUTO_SHOP";
  if (!isAutoShop && !user.features.includes("invoices")) redirect("/");
  const { customerId: cIdFromQuery, vehicleId: vIdFromQuery } =
    await searchParams;

  // If vehicleId provided, derive customer from vehicle
  let customerId = cIdFromQuery ?? undefined;
  const vehicleId = vIdFromQuery ?? undefined;

  if (vehicleId && !customerId) {
    const v = await db.vehicle.findFirst({
      where: { id: vehicleId, orgId },
      select: { customerId: true },
    });
    if (!v) notFound();
    customerId = v.customerId;
  }

  // Step 1: pick or inline-create a customer
  if (!customerId) {
    const customers = await db.customer.findMany({
      where: { orgId },
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

    async function pickOrCreateCustomer(fd: FormData) {
      "use server";
      const innerOrgId = await requireOrgId();
      const mode = fd.get("mode");

      // Inline-create a brand new customer (walk-in) then continue the flow.
      if (mode === "new") {
        const get = (k: string) => {
          const v = fd.get(k);
          return typeof v === "string" && v.trim() ? v.trim() : null;
        };
        const firstName = get("firstName");
        const lastName = get("lastName");
        // Names are required client-side; guard here too so a bad submit is a
        // no-op rather than a crash.
        if (!firstName || !lastName) return;
        const type = get("type") === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL";
        const created = await db.customer.create({
          data: {
            orgId: innerOrgId,
            type,
            firstName,
            lastName,
            companyName: get("companyName"),
            phone: get("phone"),
            altPhone: get("altPhone"),
            email: get("email"),
          },
        });
        revalidatePath("/customers");
        revalidatePath("/");
        redirect(`/repair-orders/new?customerId=${created.id}`);
      }

      const id = fd.get("customerId");
      if (typeof id !== "string" || !id) return;
      redirect(`/repair-orders/new?customerId=${id}`);
    }

    return (
      <>
        <PageHeader
          title="New Repair Order"
          description="Step 1: pick or add a customer"
        />
        <Card className="p-6">
          <CustomerPickerOrCreate
            action={pickOrCreateCustomer}
            customers={customers}
          />
        </Card>
      </>
    );
  }

  const customer = await db.customer.findFirst({
    where: { id: customerId, orgId },
    include: { vehicles: { orderBy: { createdAt: "desc" } } },
  });
  if (!customer) notFound();

  if (!vehicleId && !isAutoShop) {
    return (
      <>
        <PageHeader
          title="New Invoice"
          description={`Create an invoice for ${fullName(customer)}`}
        />
        <Card className="p-6">
          <form action={createRepairOrder} className="space-y-4 max-w-2xl">
            <input type="hidden" name="customerId" value={customer.id} />
            <Field label="Description">
              <Textarea
                name="complaint"
                rows={3}
                placeholder="What is this invoice for?"
              />
            </Field>
            <Button type="submit">Create Invoice</Button>
          </form>
        </Card>
      </>
    );
  }

  // Step 2: pick vehicle if not provided — OR inline-create one
  if (!vehicleId) {
    async function pickOrCreateVehicle(fd: FormData) {
      "use server";
      const innerOrgId = await requireOrgId();
      const c = fd.get("customerId");
      if (typeof c !== "string" || !c) return;
      // Ensure the customer belongs to this org before linking a vehicle.
      const ownerCustomer = await db.customer.findFirst({
        where: { id: c, orgId: innerOrgId },
        select: { id: true },
      });
      if (!ownerCustomer) return;
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
          orgId: innerOrgId,
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
          mileage: parseMileage(mileageStr),
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

  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, orgId },
  });
  if (!vehicle || vehicle.customerId !== customer.id) notFound();

  const [openROs, pastROs] = await Promise.all([
    openROsForVehicle(orgId, vehicle.id),
    pastROsForVehicle(orgId, vehicle.id),
  ]);

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
      {pastROs.length > 0 && (
        <div className="mb-4">
          <DuplicateROBanner
            tone="info"
            ros={pastROs}
            heading={`Past tickets for this vehicle (${pastROs.length})`}
            subheading="Already paid, invoiced or cancelled. Check these so you don't duplicate work that was done before."
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
            <MileageInput
              name="mileageIn"
              defaultValue={vehicle.mileage ?? null}
            />
          </Field>
          <Button type="submit">Create Repair Order</Button>
        </form>
      </Card>
    </>
  );
}
