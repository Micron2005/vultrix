import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  badRequest,
  validationError,
  withApiKey,
} from "@/lib/apiV1";

const CustomerSchema = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]).default("INDIVIDUAL"),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  companyName: z.string().trim().nullable().optional(),
  email: z
    .string()
    .trim()
    .email()
    .nullable()
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().nullable().optional(),
  altPhone: z.string().trim().nullable().optional(),
  street: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  zip: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

function customerName(customer: {
  firstName: string;
  lastName: string;
  companyName: string | null;
}): string {
  return (
    customer.companyName?.trim() ||
    `${customer.firstName} ${customer.lastName}`.trim()
  );
}

export async function GET(request: Request) {
  return withApiKey(request, async (orgId) => {
    const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
    const customers = await db.customer.findMany({
      where: {
        orgId,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { companyName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        firstName: true,
        lastName: true,
        companyName: true,
        phone: true,
        email: true,
      },
    });
    return NextResponse.json({
      customers: customers.map((customer) => ({
        ...customer,
        name: customerName(customer),
      })),
    });
  });
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
      const data = CustomerSchema.parse(body);
      const customer = await db.customer.create({
        data: { ...data, orgId },
        select: {
          id: true,
          type: true,
          firstName: true,
          lastName: true,
          companyName: true,
          phone: true,
          email: true,
        },
      });
      return NextResponse.json(
        { customer: { ...customer, name: customerName(customer) } },
        { status: 201 },
      );
    } catch (error) {
      return validationError(error);
    }
  });
}
