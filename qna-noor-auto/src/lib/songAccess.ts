import type { Prisma } from "@prisma/client";

export function songAccessWhere(orgId: string): Prisma.SongWhereInput {
  return { OR: [{ orgId }, { members: { some: { orgId } } }] };
}

export function beatAccessWhere(orgId: string): Prisma.BeatWhereInput {
  return { OR: [{ orgId }, { song: songAccessWhere(orgId) }] };
}
