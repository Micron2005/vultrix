/**
 * One-time bootstrap for the multi-tenant accounts foundation (Phase 2).
 *
 * Safe to run multiple times — it only creates what's missing:
 *   1. A starter Organization (named from the shop's current shopName setting).
 *   2. An OWNER login for that organization.
 *   3. A platform SUPERADMIN login (no organization) for M.S.A.M Industries.
 *
 * Credentials come from env vars, with dev-only defaults you MUST change:
 *   OWNER_USERNAME / OWNER_PASSWORD
 *   SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD
 *
 * Run with:  pnpm db:bootstrap
 */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function main() {
  const ownerUsername = (process.env.OWNER_USERNAME || "owner").toLowerCase();
  const ownerPassword = process.env.OWNER_PASSWORD || "changeme123";
  const superUsername = (
    process.env.SUPERADMIN_USERNAME || "admin"
  ).toLowerCase();
  const superPassword = process.env.SUPERADMIN_PASSWORD || "changeme123";

  // 1. Starter organization from the existing shop name.
  let org = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  if (!org) {
    const shopName = await db.shopSetting.findUnique({
      where: { key: "shopName" },
    });
    org = await db.organization.create({
      data: { name: shopName?.value || "My Shop", status: "ACTIVE" },
    });
    console.log(`Created starter organization: "${org.name}" (${org.id})`);
  } else {
    console.log(`Organization already exists: "${org.name}" (${org.id})`);
  }

  // 2. Owner login for that org.
  const existingOwner = await db.user.findUnique({
    where: { username: ownerUsername },
  });
  if (!existingOwner) {
    await db.user.create({
      data: {
        username: ownerUsername,
        passwordHash: hashPassword(ownerPassword),
        role: "OWNER",
        orgId: org.id,
      },
    });
    console.log(
      `Created OWNER login "${ownerUsername}" (password: ${ownerPassword}) — change it after first sign-in.`,
    );
  } else {
    console.log(`Owner login "${ownerUsername}" already exists — skipped.`);
  }

  // 3. Platform superadmin (no organization).
  const existingSuper = await db.user.findUnique({
    where: { username: superUsername },
  });
  if (!existingSuper) {
    await db.user.create({
      data: {
        username: superUsername,
        passwordHash: hashPassword(superPassword),
        role: "SUPERADMIN",
        orgId: null,
      },
    });
    console.log(
      `Created SUPERADMIN login "${superUsername}" (password: ${superPassword}) — change it after first sign-in.`,
    );
  } else {
    console.log(`Superadmin login "${superUsername}" already exists — skipped.`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
