import { ACTIVE_RO_WHERE, db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { LinkButton, PageHeader } from "@/components/ui";
import { findNormalizedSearchMatches } from "@/lib/search";
import { CustomerList } from "../customers/CustomerList";

export const dynamic = "force-dynamic";

export default async function BusinessesPage({
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
      type: "BUSINESS",
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
    orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
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
        title="Businesses"
        description="Fleets, shops, and company accounts."
        actions={
          <LinkButton href="/businesses/new">New Business</LinkButton>
        }
      />

      <CustomerList
        kind="BUSINESS"
        customers={customers}
        query={query}
        newHref="/businesses/new"
        searchPath="/businesses"
      />
    </>
  );
}
