import { db } from "@/lib/db";

export type IncomeInput = {
  amount: number;
  receivedAt: Date;
  source: string;
  frequency: string;
  note?: string | null;
};

export async function createIncomeForOrg(orgId: string, input: IncomeInput) {
  return db.income.create({ data: { ...input, orgId } });
}
