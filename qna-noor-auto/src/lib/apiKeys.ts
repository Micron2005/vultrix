import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const TOKEN_PREFIX = "vtx_live_";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createApiKey(
  orgId: string,
  name: string,
): Promise<string> {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  await db.apiKey.create({
    data: {
      orgId,
      name,
      tokenHash: hashToken(token),
      prefix: token.slice(0, TOKEN_PREFIX.length + 8),
    },
  });
  return token;
}

export async function listApiKeys(orgId: string) {
  return db.apiKey.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });
}

export async function revokeApiKey(orgId: string, id: string): Promise<void> {
  await db.apiKey.updateMany({
    where: { id, orgId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function authenticateApiKey(
  request: Request,
): Promise<{ orgId: string } | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;

  const key = await db.apiKey.findUnique({
    where: { tokenHash: hashToken(match[1]) },
    select: {
      id: true,
      orgId: true,
      revokedAt: true,
      organization: { select: { status: true } },
    },
  });
  if (
    !key ||
    key.revokedAt ||
    !key.organization ||
    key.organization.status.toUpperCase() !== "ACTIVE"
  ) {
    return null;
  }

  void db.apiKey
    .update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);

  return { orgId: key.orgId };
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    },
  );
}
