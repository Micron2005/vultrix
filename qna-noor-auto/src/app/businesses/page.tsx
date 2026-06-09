import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { LinkButton, PageHeader } from "@/components/ui";
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

  const customers = await db.customer.findMany({
    where: {
      orgId,
      type: "BUSINESS",
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
    orderBy: [{ companyName: "asc" }, { lastName: "asc" }],
    include: {
      _count: { select: { vehicles: true, repairOrders: true } },
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
