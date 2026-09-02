import { MoneyOwedCard } from "@/components/MoneyOwedCard";
import { StatCard } from "@/components/StatCard";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import { enabledFeatureSet, repairOrderNouns } from "@/lib/features";
import { computeTotals, excludeDeclinedJobLines } from "@/lib/totals";
import { loadAppliedShopFeesForROs } from "@/lib/shopFees";
import { formatMoney, fullName } from "@/lib/utils";

export async function CountsBlock({
  orgId,
  user,
}: {
  orgId: string;
  user: CurrentUser;
}) {
  const features = enabledFeatureSet(user);
  const nouns = repairOrderNouns(user.accountType);
  const autoShop = (user.accountType ?? "AUTO_SHOP") === "AUTO_SHOP";
  const hasCustomers = features.has("customers");
  const hasVehicles = features.has("vehicles");
  const hasRepairOrders = features.has("repair_orders");
  const hasInvoices = features.has("invoices");
  const hasRecords = hasRepairOrders || hasInvoices;
  const hasFinancials = features.has("financials");
  const showMoneyCards =
    user.role !== "STAFF" && ((hasFinancials && hasRecords) || hasInvoices);
  const [customerCount, vehicleCount, openROs, paidThisMonthROs, outstandingROs] =
    await Promise.all([
      hasCustomers ? db.customer.count({ where: { orgId } }) : Promise.resolve(0),
      hasVehicles ? db.vehicle.count({ where: { orgId } }) : Promise.resolve(0),
      hasRecords
        ? db.repairOrder.count({
            where: {
              orgId,
              status: { in: ["ESTIMATE", "IN_PROGRESS", "COMPLETED"] },
            },
          })
        : Promise.resolve(0),
      showMoneyCards && hasFinancials && hasRecords
        ? db.repairOrder.findMany({
            where: {
              orgId,
              status: "PAID",
              closedAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
            },
            include: {
              jobs: { select: { id: true, approvalStatus: true } },
              laborLines: true,
              partLines: true,
              feeLines: true,
            },
          })
        : Promise.resolve([]),
      showMoneyCards && hasInvoices
        ? db.repairOrder.findMany({
            where: { orgId, status: "INVOICED" },
            orderBy: { invoicedAt: "asc" },
            include: {
              customer: true,
              vehicle: true,
              jobs: { select: { id: true, approvalStatus: true } },
              laborLines: true,
              partLines: true,
              feeLines: true,
              payments: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const paidShopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    paidThisMonthROs.map((ro) => {
      const totals = computeTotals(excludeDeclinedJobLines(ro));
      return {
        id: ro.id,
        partsSubtotal: totals.partsSubtotal,
        laborSubtotal: totals.laborSubtotal,
      };
    }),
  );
  const revenueThisMonth = paidThisMonthROs.reduce(
    (sum, ro) =>
      sum +
      computeTotals({
        ...excludeDeclinedJobLines(ro),
        shopFees: paidShopFeesByRO.get(ro.id) ?? [],
      }).total,
    0,
  );

  const outstandingShopFeesByRO = await loadAppliedShopFeesForROs(
    orgId,
    outstandingROs.map((ro) => {
      const totals = computeTotals(excludeDeclinedJobLines(ro));
      return {
        id: ro.id,
        partsSubtotal: totals.partsSubtotal,
        laborSubtotal: totals.laborSubtotal,
      };
    }),
  );
  const outstandingWithBalance = outstandingROs
    .map((ro) => {
      const total = computeTotals({
        ...excludeDeclinedJobLines(ro),
        shopFees: outstandingShopFeesByRO.get(ro.id) ?? [],
      }).total;
      const paid = ro.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = Math.round((total - paid) * 100) / 100;
      return { ro, balance };
    })
    .filter((item) => item.balance > 0);
  const moneyOwed = outstandingWithBalance.reduce(
    (sum, item) => sum + item.balance,
    0,
  );
  const moneyOwedIndividuals = outstandingWithBalance
    .filter((item) => item.ro.customer.type !== "BUSINESS")
    .reduce((sum, item) => sum + item.balance, 0);
  const moneyOwedBusinesses = outstandingWithBalance
    .filter((item) => item.ro.customer.type === "BUSINESS")
    .reduce((sum, item) => sum + item.balance, 0);
  const owedByCustomer = new Map<
    string,
    { id: string; name: string; amount: number; invoiceCount: number }
  >();
  for (const { ro, balance } of outstandingWithBalance) {
    const existing = owedByCustomer.get(ro.customerId);
    if (existing) {
      existing.amount += balance;
      existing.invoiceCount += 1;
    } else {
      owedByCustomer.set(ro.customerId, {
        id: ro.customerId,
        name: fullName(ro.customer),
        amount: balance,
        invoiceCount: 1,
      });
    }
  }
  const owedCustomers = Array.from(owedByCustomer.values())
    .sort((a, b) => b.amount - a.amount)
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      amount: formatMoney(customer.amount),
      invoiceCount: customer.invoiceCount,
    }));
  const hasAnyCard =
    hasCustomers ||
    hasVehicles ||
    hasRecords ||
    (showMoneyCards && (hasFinancials || hasInvoices));
  if (!hasAnyCard) return null;

  return (
    <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-3 lg:grid-cols-5">
      {hasCustomers && (
        <StatCard label="Customers" value={customerCount.toString()} href="/customers" />
      )}
      {hasVehicles && (
        <StatCard label="Vehicles" value={vehicleCount.toString()} href="/vehicles" />
      )}
      {hasRecords && (
        <StatCard
          label={autoShop ? "Open ROs" : `Open ${nouns.plural.toLowerCase()}`}
          value={openROs.toString()}
          href="/repair-orders"
        />
      )}
      {showMoneyCards && hasFinancials && hasRecords && (
        <StatCard label="Revenue (this month)" value={formatMoney(revenueThisMonth)} />
      )}
      {showMoneyCards && hasInvoices && (
        <MoneyOwedCard
          label={`Money owed${outstandingWithBalance.length ? ` (${outstandingWithBalance.length})` : ""}`}
          value={formatMoney(moneyOwed)}
          highlight={moneyOwed > 0}
          sublines={
            moneyOwed > 0
              ? [
                  `Individuals · ${formatMoney(moneyOwedIndividuals)}`,
                  `Businesses · ${formatMoney(moneyOwedBusinesses)}`,
                ]
              : undefined
          }
          customers={owedCustomers}
        />
      )}
    </div>
  );
}
