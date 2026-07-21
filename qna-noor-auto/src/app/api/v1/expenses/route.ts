import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  badRequest,
  parseDateParam,
  validationError,
  withApiKey,
} from "@/lib/apiV1";

const ExpenseSchema = z.object({
  amount: z.number().finite().positive(),
  category: z.string().trim().min(1).optional().default("MISC"),
  date: z.string().trim().optional(),
  paidAt: z.string().trim().optional(),
  vendor: z.string().trim().nullable().optional(),
  reference: z.string().trim().nullable().optional(),
  paymentMethod: z.string().trim().nullable().optional(),
  method: z.string().trim().nullable().optional(),
  note: z.string().trim().nullable().optional(),
});

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function parseExpenseDate(value: string | undefined): Date {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(NaN) : date;
}

export async function POST(request: Request) {
  return withApiKey(request, async (orgId) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }
    try {
      const data = ExpenseSchema.parse(body);
      const paidAt = parseExpenseDate(data.date ?? data.paidAt);
      if (Number.isNaN(paidAt.getTime())) {
        return badRequest("date must be a valid date");
      }
      const expense = await db.expense.create({
        data: {
          orgId,
          amount: data.amount,
          category: data.category.toUpperCase(),
          paidAt,
          vendor: clean(data.vendor),
          reference: clean(data.reference),
          method: clean(data.paymentMethod ?? data.method),
          note: clean(data.note),
        },
      });
      return NextResponse.json({ expense }, { status: 201 });
    } catch (error) {
      return validationError(error);
    }
  });
}

export async function GET(request: Request) {
  return withApiKey(request, async (orgId) => {
    const params = new URL(request.url).searchParams;
    const from = parseDateParam(params.get("from"), "from");
    const to = parseDateParam(params.get("to"), "to", true);
    if (from instanceof Response) return from;
    if (to instanceof Response) return to;

    const expenses = await db.expense.findMany({
      where: { orgId, paidAt: { gte: from, lte: to } },
      orderBy: { paidAt: "desc" },
    });
    return NextResponse.json({ expenses });
  });
}
