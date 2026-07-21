import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authenticateApiKey, unauthorizedResponse } from "@/lib/apiKeys";

export type ApiHandler = (orgId: string) => Promise<Response>;

export async function withApiKey(
  request: Request,
  handler: ApiHandler,
): Promise<Response> {
  const auth = await authenticateApiKey(request);
  if (!auth) return unauthorizedResponse();
  return handler(auth.orgId);
}

export function validationError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function parseDateParam(
  value: string | null,
  field: string,
  endOfDay = false,
): Date | NextResponse {
  if (!value) {
    return endOfDay ? new Date() : new Date(0);
  }
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime())) {
    return badRequest(`${field} must be a valid date in YYYY-MM-DD format`);
  }
  return date;
}
