import { randomBytes } from "crypto";
import { db } from "./db";

async function newToken(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = randomBytes(16).toString("base64url");
    const existing = await db.customer.findUnique({
      where: { portalToken: token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("Could not generate unique portal token");
}

export async function newPortalToken(): Promise<string> {
  return newToken();
}

export async function ensurePortalToken(
  orgId: string,
  customerId: string,
): Promise<string> {
  const customer = await db.customer.findFirst({
    where: { id: customerId, orgId },
    select: { portalToken: true },
  });
  if (!customer) throw new Error("Customer not found");
  if (customer.portalToken) return customer.portalToken;

  const token = await newToken();
  await db.customer.update({
    where: { id: customerId, orgId },
    data: { portalToken: token },
  });
  return token;
}
