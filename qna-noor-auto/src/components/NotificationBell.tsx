"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationResponse = {
  unread: number;
  items: NotificationItem[];
};

function relativeTime(value: string): string {
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 60 * 60) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 24 * 60 * 60) return `${Math.floor(seconds / (60 * 60))}h ago`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function readNotifications(body: { ids?: string[]; all?: boolean }) {
  await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationResponse>({
    unread: 0,
    items: [],
  });
  const containerRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const next = (await response.json()) as NotificationResponse;
      setData(next);
    } catch {
      // Notifications are a convenience; keep the navigation usable if they fail.
    }
  }

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function openItem(item: NotificationItem) {
    if (!item.readAt) {
      await readNotifications({ ids: [item.id] });
      setData((current) => ({
        unread: Math.max(0, current.unread - 1),
        items: current.items.map((entry) =>
          entry.id === item.id
            ? { ...entry, readAt: new Date().toISOString() }
            : entry,
        ),
      }));
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  async function markAllRead() {
    await readNotifications({ all: true });
    setData((current) => ({
      unread: 0,
      items: current.items.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    }));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        aria-label="Notifications"
        aria-expanded={open}
        data-testid="notification-bell"
      >
        <Bell className="h-5 w-5" />
        {data.unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[var(--vx-accent-600)] px-1 text-center text-[10px] font-semibold leading-4 text-[var(--vx-accent-fg)]">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-md border border-zinc-200 bg-white shadow-lg"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Notifications
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-medium text-[var(--vx-accent-600)] hover:underline"
              >
                Mark all read
              </button>
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:underline"
              >
                See all
              </Link>
            </div>
          </div>
          {data.items.length ? (
            <div className="max-h-96 overflow-y-auto py-1">
              {data.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openItem(item)}
                  className={
                    "block w-full border-l-2 px-4 py-3 text-left hover:bg-zinc-50 " +
                    (item.readAt
                      ? "border-transparent"
                      : "border-[var(--vx-accent-600)]")
                  }
                >
                  <p className="text-sm font-medium text-zinc-900">
                    {item.title}
                  </p>
                  {item.body && (
                    <p className="mt-1 text-xs text-zinc-500">{item.body}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-500">
                    {relativeTime(item.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">
              You&apos;re all caught up.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
