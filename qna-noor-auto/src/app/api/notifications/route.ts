import { NextResponse } from "next/server";
import {
  listNotifications,
  markRead,
  unreadCount,
} from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!user.orgId) {
    return NextResponse.json({ unread: 0, items: [] });
  }
  const [unread, items] = await Promise.all([
    unreadCount(user),
    listNotifications(user, { limit: 20 }),
  ]);
  return NextResponse.json({ unread, items });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!user.orgId) {
    return NextResponse.json({ unread: 0 });
  }
  let body: { ids?: string[]; all?: boolean } = {};
  try {
    body = (await request.json()) as { ids?: string[]; all?: boolean };
  } catch {
    body = {};
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string")
    : [];
  await markRead(user, body.all ? "all" : ids);
  return NextResponse.json({ ok: true });
}
