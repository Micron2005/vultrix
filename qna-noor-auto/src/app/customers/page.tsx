import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { LinkButton, PageHeader } from "@/components/ui";
import { CustomerList } from "./CustomerList";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const orgId = await requireOrgId();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const customers = await db.customer.findMany({
    where: {
      orgId,
      type: "INDIVIDUAL",
      ...(query
        ? {
            OR: [
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { companyName: { contains: query } },
              { email: { contains: query } },
              { phone: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      _count: { select: { vehicles: true, repairOrders: true } },
    },
    take: 500,
  });

  return (
    <>
      <PageHeader
        title="Customers"
        description="Individuals — people who bring their own vehicle in."
        actions={<LinkButton href="/customers/new">New Customer</LinkButton>}
      />

      <CustomerList
        kind="INDIVIDUAL"
        customers={customers}
        query={query}
        newHref="/customers/new"
        searchPath="/customers"
      />
    </>
  );
}
