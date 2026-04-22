import Link from "next/link";
import { db } from "@/lib/db";
import {
  Card,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { fullName, vehicleLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const vehicles = await db.vehicle.findMany({
    where: query
      ? {
          OR: [
            { vin: { contains: query, mode: "insensitive" } },
            { licensePlate: { contains: query, mode: "insensitive" } },
            { make: { contains: query, mode: "insensitive" } },
            { model: { contains: query, mode: "insensitive" } },
            { customer: { lastName: { contains: query, mode: "insensitive" } } },
            { customer: { firstName: { contains: query, mode: "insensitive" } } },
            {
              customer: {
                companyName: { contains: query, mode: "insensitive" },
              },
            },
          ],
        }
      : undefined,
    include: { customer: true },
    orderBy: [{ year: "desc" }, { make: "asc" }],
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Vehicles"
        description="All vehicles across all customers"
      />

      <form className="mb-4 max-w-md" method="GET">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search VIN, plate, make, model, or customer…"
        />
      </form>

      {vehicles.length === 0 ? (
        <EmptyState
          title={query ? "No vehicles matched your search" : "No vehicles yet"}
          description={
            query ? undefined : "Add a customer, then add their vehicles."
          }
          action={
            !query && <LinkButton href="/customers/new">New Customer</LinkButton>
          }
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 font-medium">Vehicle</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">VIN</th>
                <th className="px-4 py-2 font-medium">Plate</th>
                <th className="px-4 py-2 font-medium text-right">Mileage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/vehicles/${v.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {vehicleLabel(v)}
                    </Link>
                    {v.color && (
                      <span className="ml-2 text-xs text-zinc-500">
                        {v.color}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/customers/${v.customerId}`}
                      className="text-zinc-700 hover:underline"
                    >
                      {fullName(v.customer)}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600">
                    {v.vin ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {v.licensePlate ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-600">
                    {v.mileage?.toLocaleString() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
