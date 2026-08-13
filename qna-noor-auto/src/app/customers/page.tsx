import { ACTIVE_RO_WHERE, db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { LinkButton, PageHeader } from "@/components/ui";
import { findNormalizedSearchMatches } from "@/lib/search";
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
  const { customerIdsByToken } = await findNormalizedSearchMatches(
    orgId,
    query ? [query] : [],
  );
  const normalizedCustomerIds = customerIdsByToken[0] ?? [];

  const customers = await db.customer.findMany({
    where: {
      orgId,
      type: "INDIVIDUAL",
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { companyName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { altPhone: { contains: query, mode: "insensitive" } },
              ...(normalizedCustomerIds.length > 0
                ? [{ id: { in: normalizedCustomerIds } }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      _count: {
        select: {
          vehicles: true,
          repairOrders: { where: ACTIVE_RO_WHERE },
        },
      },
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
