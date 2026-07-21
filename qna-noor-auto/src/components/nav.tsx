"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Menu, X, ExternalLink } from "lucide-react";

type NavProps = {
  orgLabel: string;
  canManageUsers?: boolean;
  username?: string | null;
  isSuperadmin?: boolean;
  enabledFeatures?: string[];
};

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Customers", feature: "customers" },
  { href: "/businesses", label: "Businesses" },
  { href: "/vehicles", label: "Vehicles", feature: "vehicles" },
  { href: "/vehicle-search", label: "Lookup", feature: "lookup" },
  { href: "/repair-orders", label: "Repair Orders", feature: "repair_orders" },
  { href: "/appointments", label: "Schedule", feature: "schedule" },
  { href: "/reminders", label: "Reminders", feature: "reminders" },
  { href: "/notes", label: "Knowledge", feature: "knowledge" },
  { href: "/technicians", label: "Technicians", feature: "technicians" },
  { href: "/inventory", label: "Inventory", feature: "inventory" },
  { href: "/canned-jobs", label: "Presets", feature: "presets" },
  { href: "/expenses", label: "Financials", feature: "financials" },
  { href: "/reports", label: "Reports", feature: "reports" },
  { href: "/import", label: "Import", feature: "import_export" },
  { href: "/export", label: "Export", feature: "import_export" },
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
  enabledFeatures = [],
}: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  // Platform admins (no organization) only ever manage businesses — the shop
  // data pages are meaningless to them, so show a focused platform menu.
  const navItems = (isSuperadmin
    ? [
        { href: "/admin", label: "Manage businesses" },
        { href: "/admin/leads", label: "Leads" },
      ]
    : canManageUsers
      ? [
          ...items,
          { href: "/settings/users", label: "Logins" },
          { href: "/billing", label: "Billing" },
        ]
      : items
  ).filter((item) => !item.feature || enabledFeatures.includes(item.feature));

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
    pathname === "/home" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/flyer"
  )
    return null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const sidebarBody = (
    <>
      <div className="p-5 border-b border-zinc-200 flex items-center justify-between gap-2">
        <Link href="/" className="block min-w-0" onClick={closeMobile}>
          <div className="text-sm font-semibold tracking-tight text-zinc-900 truncate">
            {orgLabel}
          </div>
          {username && (
            <div className="text-xs text-zinc-500 truncate">{username}</div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
          aria-label="Close menu"
          data-testid="nav-close-button"
        >
          <X className="h-5 w-5" />
        </button>
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
              onClick={closeMobile}
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
        <a
          href="/home"
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeMobile}
          className="mt-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          data-testid="nav-view-landing"
        >
          <ExternalLink className="h-4 w-4" />
          View landing page
        </a>
        <form action="/logout" method="post" className="mt-1 border-t border-zinc-200 pt-2">
          <button
            type="submit"
            className="w-full text-left rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            data-testid="nav-sign-out"
          >
            Sign out
          </button>
        </form>
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile top bar — only on small screens. */}
      <header className="no-print lg:hidden fixed top-0 inset-x-0 z-40 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          data-testid="nav-open-button"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link
          href="/"
          className="min-w-0 truncate text-sm font-semibold tracking-tight text-zinc-900"
        >
          {orgLabel}
        </Link>
      </header>

      {/* Backdrop behind the open drawer (mobile only). */}
      {mobileOpen && (
        <div
          className="no-print lg:hidden fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          data-testid="nav-backdrop"
        />
      )}

      {/* Sidebar: static column on desktop, slide-in drawer on mobile. */}
      <aside
        className={
          "no-print bg-white border-r border-zinc-200 overflow-y-auto " +
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-out " +
          "lg:static lg:z-auto lg:w-56 lg:shrink-0 lg:translate-x-0 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
        data-testid="app-sidebar"
      >
        {sidebarBody}
      </aside>
    </>
  );
}
