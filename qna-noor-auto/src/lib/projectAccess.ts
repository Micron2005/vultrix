import type { Prisma } from "@prisma/client";

export function projectAccessWhere(orgId: string): Prisma.ProjectWhereInput {
  return {
    OR: [{ orgId }, { members: { some: { orgId } } }],
  };
}
