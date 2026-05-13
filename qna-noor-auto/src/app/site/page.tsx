import Link from "next/link";
import { db } from "@/lib/db";
import { getAllSettings } from "@/lib/shop";
import { isAuthenticated } from "@/lib/auth";
import { LandingCanvas } from "./LandingCanvas";

export const dynamic = "force-dynamic";

export default async function SitePage() {
  const [shop, blocks, authed] = await Promise.all([
    getAllSettings(),
    db.landingBlock.findMany({ orderBy: { sortOrder: "asc" } }),
    isAuthenticated(),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div className="text-lg font-bold text-zinc-900">
              {shop.shopName}
            </div>
            {shop.shopAddress && (
              <div className="text-xs text-zinc-600 whitespace-pre-line">
                {shop.shopAddress}
              </div>
            )}
            {(shop.shopPhone || shop.shopEmail) && (
              <div className="text-xs text-zinc-600">
                {[shop.shopPhone, shop.shopEmail].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {authed ? (
              <>
                <Link
                  href="/site/edit"
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Edit page
                </Link>
                <Link
                  href="/"
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <Link
                href="/login?next=/site/edit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero section with shop details */}
      <section className="bg-zinc-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {shop.shopName}
          </h1>
          {shop.shopAddress && (
            <p className="mt-4 text-lg text-zinc-300 whitespace-pre-line">
              {shop.shopAddress}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-zinc-300">
            {shop.shopPhone && (
              <a
                href={`tel:${shop.shopPhone}`}
                className="flex items-center gap-2 hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                {shop.shopPhone}
              </a>
            )}
            {shop.shopEmail && (
              <a
                href={`mailto:${shop.shopEmail}`}
                className="flex items-center gap-2 hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                {shop.shopEmail}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Custom content blocks */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        {blocks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-zinc-400 text-lg">
              {authed
                ? "No content yet. Click \"Edit page\" to add text and images."
                : ""}
            </div>
          </div>
        ) : (
          <LandingCanvas blocks={blocks} editable={false} />
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-zinc-500">
          {shop.shopName}
          {shop.shopAddress && ` · ${shop.shopAddress.replace(/\n/g, ", ")}`}
          {shop.shopPhone && ` · ${shop.shopPhone}`}
        </div>
      </footer>
    </div>
  );
}
