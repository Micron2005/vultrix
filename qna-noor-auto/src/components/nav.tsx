"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";

type NavProps = {
  orgLabel: string;
  canManageUsers?: boolean;
  username?: string | null;
  isSuperadmin?: boolean;
};

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/businesses", label: "Businesses" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/vehicle-search", label: "Lookup" },
  { href: "/repair-orders", label: "Repair Orders" },
  { href: "/appointments", label: "Schedule" },
  { href: "/reminders", label: "Reminders" },
  { href: "/notes", label: "Knowledge" },
  { href: "/technicians", label: "Technicians" },
  { href: "/inventory", label: "Inventory" },
  { href: "/canned-jobs", label: "Presets" },
  { href: "/expenses", label: "Financials" },
  { href: "/reports", label: "Reports" },
  { href: "/import", label: "Import" },
  { href: "/export", label: "Export" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Nav({
  orgLabel,
  canManageUsers,
  username,
  isSuperadmin,
}: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");

  // Platform admins (no organization) only ever manage businesses — the shop
  // data pages are meaningless to them, so show a focused platform menu.
  const navItems = isSuperadmin
    ? [{ href: "/admin", label: "Manage businesses" }]
    : canManageUsers
      ? [
          ...items,
          { href: "/settings/users", label: "Logins" },
          { href: "/billing", label: "Billing" },
        ]
      : items;

  // Hide the shop sidebar on public, customer-facing routes and on login.
  // Also hide on the QR-scan flow so techs scanning stickers on their phone
  // see a single-column page with no chrome in the way.
  if (
    pathname?.startsWith("/e/") ||
    pathname?.startsWith("/p/") ||
    pathname?.startsWith("/a/") ||
    pathname?.startsWith("/s/") ||
    pathname?.startsWith("/q/") ||
    pathname?.startsWith("/inventory/qr-sheet") ||
    pathname?.endsWith("/qr") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/terms" ||
    pathname === "/privacy"
  )
    return null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <aside className="no-print w-56 shrink-0 border-r border-zinc-200 bg-white">
      <div className="p-5 border-b border-zinc-200">
        <Link href="/" className="block">
          <div className="text-sm font-semibold tracking-tight text-zinc-900">
            {orgLabel}
          </div>
          {username && (
            <div className="text-xs text-zinc-500">{username}</div>
          )}
        </Link>
      </div>
      {!isSuperadmin && (
        <form onSubmit={onSubmit} className="p-3 border-b border-zinc-200">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customers, ROs, VIN…"
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            aria-label="Search"
          />
        </form>
      )}
      <nav className="p-2 flex flex-col gap-1">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "rounded-md px-3 py-2 text-sm transition-colors " +
                (active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900")
              }
            >
              {item.label}
            </Link>
          );
        })}
        <form action="/logout" method="post" className="mt-2 border-t border-zinc-200 pt-2">
          <button
            type="submit"
            className="w-full text-left rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            Sign out
          </button>
        </form>
      </nav>
    </aside>
  );
}
