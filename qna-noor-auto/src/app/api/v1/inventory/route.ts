import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, validationError, withApiKey } from "@/lib/apiV1";

const PartSchema = z.object({
  partNumber: z.string().trim().nullable().optional(),
  name: z.string().trim().min(1),
  description: z.string().trim().nullable().optional(),
  category: z.string().trim().nullable().optional(),
  unit: z.string().trim().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  source: z.string().trim().nullable().optional(),
  cost: z.number().finite().nonnegative().nullable().optional(),
  price: z.number().finite().nonnegative().nullable().optional(),
  reorderLevel: z.number().finite().nonnegative().optional().default(0),
  quantity: z.number().finite().optional().default(0),
  notes: z.string().trim().nullable().optional(),
});

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export async function GET(request: Request) {
  return withApiKey(request, async (orgId) => {
    const search = new URL(request.url).searchParams.get("search")?.trim() ?? "";
    const parts = await db.part.findMany({
      where: {
        orgId,
        archived: false,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { partNumber: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      take: 100,
      select: {
        id: true,
        name: true,
        partNumber: true,
        qtyOnHand: true,
        unit: true,
        unitPrice: true,
        location: true,
        category: true,
      },
    });
    return NextResponse.json({ inventory: parts });
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
      const data = PartSchema.parse(body);
      const part = await db.part.create({
        data: {
          orgId,
          partNumber: clean(data.partNumber),
          name: data.name,
          description: clean(data.description),
          category: clean(data.category),
          unit: clean(data.unit),
          location: clean(data.location),
          source: clean(data.source),
          costPrice: data.cost ?? null,
          unitPrice: data.price ?? null,
          reorderLevel: data.reorderLevel,
          qtyOnHand: 0,
          notes: clean(data.notes),
        },
      });

      if (data.quantity !== 0) {
        await db.part.update({
          where: { id: part.id },
          data: { qtyOnHand: data.quantity },
        });
        await db.stockMove.create({
          data: {
            partId: part.id,
            delta: data.quantity,
            reason: "INITIAL",
            note: "Opening balance",
          },
        });
      }

      const result = await db.part.findFirst({
        where: { id: part.id, orgId },
        select: {
          id: true,
          name: true,
          partNumber: true,
          qtyOnHand: true,
          unit: true,
          unitPrice: true,
          location: true,
          category: true,
        },
      });
      return NextResponse.json({ inventory: result }, { status: 201 });
    } catch (error) {
      return validationError(error);
    }
  });
}
