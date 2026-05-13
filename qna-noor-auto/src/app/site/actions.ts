"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

async function requireAuth() {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

export async function getBlocks() {
  return db.landingBlock.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createBlock(data: {
  type: string;
  content?: string;
  imageData?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  await requireAuth();
  const maxSort = await db.landingBlock.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  await db.landingBlock.create({
    data: {
      type: data.type,
      content: data.content ?? "",
      imageData: data.imageData ?? null,
      x: data.x ?? 0,
      y: data.y ?? 0,
      width: data.width ?? 400,
      height: data.height ?? (data.type === "IMAGE" ? 300 : 100),
      sortOrder,
    },
  });
  revalidatePath("/site");
}

export async function updateBlock(
  id: string,
  data: {
    content?: string;
    imageData?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  },
) {
  await requireAuth();
  await db.landingBlock.update({
    where: { id },
    data: {
      ...(data.content !== undefined && { content: data.content }),
      ...(data.imageData !== undefined && { imageData: data.imageData }),
      ...(data.x !== undefined && { x: data.x }),
      ...(data.y !== undefined && { y: data.y }),
      ...(data.width !== undefined && { width: data.width }),
      ...(data.height !== undefined && { height: data.height }),
    },
  });
  revalidatePath("/site");
}

export async function deleteBlock(id: string) {
  await requireAuth();
  await db.landingBlock.delete({ where: { id } });
  revalidatePath("/site");
}

export async function reorderBlocks(orderedIds: string[]) {
  await requireAuth();
  await Promise.all(
    orderedIds.map((id, i) =>
      db.landingBlock.update({ where: { id }, data: { sortOrder: i } }),
    ),
  );
  revalidatePath("/site");
}
