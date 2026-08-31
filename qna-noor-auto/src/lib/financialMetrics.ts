import { db } from "@/lib/db";

export type FinancialRange = {
  from: Date;
  to: Date;
};

export type ExpenseCategoryTotal = {
  category: string;
  amount: number;
};

export async function loadMoneyInTotal(
  orgId: string,
  range: FinancialRange,
  hasInvoices: boolean,
): Promise<number> {
  if (hasInvoices) {
    const payments = await db.payment.findMany({
      where: {
        orgId,
        paidAt: { gte: range.from, lte: range.to },
        repairOrder: { deletedAt: null },
      },
      select: { amount: true },
    });
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }
  const income = await db.income.findMany({
    where: { orgId, receivedAt: { gte: range.from, lte: range.to } },
    select: { amount: true },
  });
  return income.reduce((sum, entry) => sum + entry.amount, 0);
}

export async function loadExpenseTotal(
  orgId: string,
  range: FinancialRange,
  category?: string | null,
): Promise<number> {
  const expenses = await db.expense.findMany({
    where: {
      orgId,
      paidAt: { gte: range.from, lte: range.to },
      ...(category ? { category } : {}),
    },
    select: { amount: true },
  });
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export async function loadExpenseCategoryTotals(
  orgId: string,
  range: FinancialRange,
): Promise<ExpenseCategoryTotal[]> {
  const expenses = await db.expense.findMany({
    where: {
      orgId,
      paidAt: { gte: range.from, lte: range.to },
    },
    select: { category: true, amount: true },
  });
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(
      expense.category,
      (totals.get(expense.category) ?? 0) + expense.amount,
    );
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
