import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, PageHeader, Select, Field, Button } from "@/components/ui";
import { VehicleForm } from "../VehicleForm";
import { createVehicle } from "../actions";
import { fullName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const { customerId } = await searchParams;

  if (customerId) {
    const customer = await db.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) notFound();

    return (
      <>
        <PageHeader
          title="New vehicle"
          description={`For ${fullName(customer)}`}
        />
        <Card className="p-6">
          <VehicleForm
            action={createVehicle}
            customerId={customer.id}
            submitLabel="Create vehicle"
          />
        </Card>
      </>
    );
  }

  // No customerId — ask them to pick
  const customers = await db.customer.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
  });

  if (customers.length === 0) {
    redirect("/customers/new");
  }

  async function pickCustomer(fd: FormData) {
    "use server";
    const id = fd.get("customerId");
    if (typeof id !== "string" || !id) return;
    redirect(`/vehicles/new?customerId=${id}`);
  }

  return (
    <>
      <PageHeader title="New vehicle" />
      <Card className="p-6">
        <form action={pickCustomer} className="space-y-4 max-w-md">
          <Field label="Customer">
            <Select name="customerId" required defaultValue="">
              <option value="" disabled>
                Select a customer…
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2 items-center">
            <Button type="submit">Continue</Button>
            <Link
              href="/customers/new"
              className="text-sm text-zinc-600 underline"
            >
              or add a new customer
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
}
