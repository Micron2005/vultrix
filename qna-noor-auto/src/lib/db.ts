import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined;
};

/**
 * Base client with NO soft-delete filtering. Used directly only by the Trash /
 * restore flows that intentionally need to see deleted repair orders.
 */
export const dbBase =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = dbBase;

/**
 * Active RepairOrder predicate for nested relation reads. The query extension
 * below only filters top-level RepairOrder operations; nested relation reads
 * and relation counts must pass this predicate explicitly.
 */
export const ACTIVE_RO_WHERE = { deletedAt: null };

/**
 * Default app client. A query extension hides soft-deleted repair orders from
 * top-level RepairOrder reads. RepairOrders read through another model's
 * include/select or counted via _count are not intercepted and must use
 * ACTIVE_RO_WHERE explicitly.
 *
 * Writes are untouched. findUnique is intentionally left unfiltered because its
 * `where` only accepts unique fields (public share/pay lookups still resolve).
 */
export const db = dbBase.$extends({
  query: {
    repairOrder: {
      async findMany({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async findFirst({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async findFirstOrThrow({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async count({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async aggregate({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      async groupBy({ args, query }) {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
    },
  },
});
