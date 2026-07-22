import { db } from "@/lib/db";

export type ExpenseInput = {
  amount: number;
  category: string;
  paidAt: Date;
  vendor?: string | null;
  reference?: string | null;
  method?: string | null;
  note?: string | null;
};

export async function createExpenseForOrg(orgId: string, input: ExpenseInput) {
  return db.expense.create({ data: { ...input, orgId } });
}
