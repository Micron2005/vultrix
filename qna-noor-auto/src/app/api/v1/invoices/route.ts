import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getNextRoNumber, getSetting } from "@/lib/shop";
import { getInvoiceTotals } from "@/lib/invoiceTotals";
import { badRequest, notFound, validationError, withApiKey } from "@/lib/apiV1";

const CustomerInput = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]).default("INDIVIDUAL"),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  companyName: z.string().trim().nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  phone: z.string().trim().nullable().optional(),
  altPhone: z.string().trim().nullable().optional(),
  street: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  zip: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

const InvoiceSchema = z
  .object({
    customerId: z.string().trim().min(1).optional(),
    customer: CustomerInput.optional(),
    complaint: z.string().trim().nullable().optional(),
    labor: z
      .array(
        z.object({
          description: z.string().trim().min(1),
          hours: z.number().finite().nonnegative(),
          rate: z.number().finite().nonnegative(),
        }),
      )
      .default([]),
    parts: z
      .array(
        z.object({
          description: z.string().trim().min(1).optional(),
          qty: z.number().finite().positive(),
          unitPrice: z.number().finite().nonnegative().optional().default(0),
          partId: z.string().trim().min(1).optional(),
        }),
      )
      .default([]),
    fees: z
      .array(
        z.object({
          description: z.string().trim().min(1),
          amount: z.number().finite().nonnegative(),
        }),
      )
      .default([]),
  })
  .superRefine((value, ctx) => {
    value.parts.forEach((part, index) => {
      if (!part.partId && !part.description) {
        ctx.addIssue({
          code: "custom",
          path: ["parts", index, "description"],
          message: "description is required when partId is not provided",
        });
      }
    });
  })
  .refine((value) => Boolean(value.customerId) !== Boolean(value.customer), {
    message: "Provide exactly one of customerId or customer",
    path: ["customerId"],
  });

const STATUSES = [
  "ESTIMATE",
  "IN_PROGRESS",
  "COMPLETED",
  "INVOICED",
  "PAID",
  "CANCELLED",
] as const;

function nameOf(customer: {
  firstName: string;
  lastName: string;
  companyName: string | null;
}): string {
  return customer.companyName?.trim() || `${customer.firstName} ${customer.lastName}`.trim();
}

async function invoiceResponse(orgId: string, id: string) {
  const ro = await db.repairOrder.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      roNumber: true,
      status: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          companyName: true,
        },
      },
    },
  });
  const totals = await getInvoiceTotals(orgId, id);
  if (!ro || !totals) return null;
  return {
    id: ro.id,
    number: ro.roNumber,
    status: ro.status,
    customer: nameOf(ro.customer),
    totals,
    path: `/repair-orders/${ro.id}`,
  };
}

export async function POST(request: Request) {
  return withApiKey(request, async (orgId) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Request body must be valid JSON");
    }

    let data: z.infer<typeof InvoiceSchema>;
    try {
      data = InvoiceSchema.parse(body);
    } catch (error) {
      return validationError(error);
    }

    const taxRate = Number.parseFloat(await getSetting(orgId, "defaultTaxRate")) || 0;
    const roNumber = await getNextRoNumber(orgId);
    if (data.customerId) {
      const customer = await db.customer.findFirst({
        where: { id: data.customerId, orgId },
        select: { id: true },
      });
      if (!customer) return notFound("Customer not found");
    }
    const partIds = data.parts.flatMap((part) => (part.partId ? [part.partId] : []));
    const catalogParts = await db.part.findMany({
      where: { id: { in: partIds }, orgId },
    });
    if (catalogParts.length !== new Set(partIds).size) {
      return notFound("Inventory part not found");
    }
    const catalogById = new Map(catalogParts.map((part) => [part.id, part]));
    const created = await db.$transaction(async (tx) => {
      let customerId = data.customerId;
      if (data.customer) {
        const customer = await tx.customer.create({
          data: { ...data.customer, orgId },
          select: { id: true },
        });
        customerId = customer.id;
      }
      if (!customerId) throw new Error("Customer is required");
      const ro = await tx.repairOrder.create({
        data: {
          orgId,
          roNumber,
          customerId,
          complaint: data.complaint ?? null,
          taxRate,
          status: "INVOICED",
          invoicedAt: new Date(),
        },
        select: { id: true },
      });

      for (const [index, labor] of data.labor.entries()) {
        await tx.laborLine.create({
          data: {
            repairOrderId: ro.id,
            description: labor.description,
            hours: labor.hours,
            rate: labor.rate,
            sortOrder: index,
          },
        });
      }
      for (const [index, part] of data.parts.entries()) {
        let catalog = null;
        if (part.partId) {
          catalog = catalogById.get(part.partId) ?? null;
        }
        const line = await tx.partLine.create({
          data: {
            repairOrderId: ro.id,
            partId: catalog?.id ?? null,
            description: part.description ?? catalog?.name ?? "",
            partNumber: catalog?.partNumber ?? null,
            quantity: part.qty,
            unitPrice: part.unitPrice ?? catalog?.unitPrice ?? 0,
            costPrice: catalog?.costPrice ?? null,
            source: catalog?.source ?? null,
            sortOrder: index,
          },
        });
        if (catalog) {
          await tx.part.update({
            where: { id: catalog.id },
            data: { qtyOnHand: { decrement: part.qty } },
          });
          await tx.stockMove.create({
            data: {
              partId: catalog.id,
              delta: -part.qty,
              reason: "USE_RO",
              partLineId: line.id,
            },
          });
        }
      }
      for (const [index, fee] of data.fees.entries()) {
        await tx.feeLine.create({
          data: {
            repairOrderId: ro.id,
            description: fee.description,
            amount: Math.round(fee.amount * 100) / 100,
            sortOrder: index,
          },
        });
      }
      return ro;
    });

    const invoice = await invoiceResponse(orgId, created.id);
    if (!invoice) return notFound("Invoice not found");
    return NextResponse.json({ invoice }, { status: 201 });
  });
}

export async function GET(request: Request) {
  return withApiKey(request, async (orgId) => {
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    const limitRaw = params.get("limit") ?? "50";
    const limit = Number.parseInt(limitRaw, 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return badRequest("limit must be an integer from 1 to 100");
    }
    if (status && !(STATUSES as readonly string[]).includes(status)) {
      return badRequest(`Unknown invoice status: ${status}`);
    }
    const invoices = await db.repairOrder.findMany({
      where: {
        orgId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: { openedAt: "desc" },
      take: limit,
      select: {
        id: true,
        roNumber: true,
        status: true,
        openedAt: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            companyName: true,
          },
        },
      },
    });
    const rows = await Promise.all(
      invoices.map(async (invoice) => ({
        id: invoice.id,
        number: invoice.roNumber,
        status: invoice.status,
        openedAt: invoice.openedAt,
        customer: nameOf(invoice.customer),
        totals: await getInvoiceTotals(orgId, invoice.id),
        path: `/repair-orders/${invoice.id}`,
      })),
    );
    return NextResponse.json({ invoices: rows });
  });
}
