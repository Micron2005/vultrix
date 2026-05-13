import Link from "next/link";
import { getAllSettings } from "@/lib/shop";
import { isAuthenticated } from "@/lib/auth";
import { getLandingContent } from "./actions";

export const dynamic = "force-dynamic";

function patternClass(pattern: string): string {
  switch (pattern) {
    case "dots":
      return "bg-pattern-dots";
    case "grid":
      return "bg-pattern-grid";
    case "diagonal":
      return "bg-pattern-diagonal";
    case "cross":
      return "bg-pattern-cross";
    case "waves":
      return "bg-pattern-waves";
    case "chevron":
      return "bg-pattern-chevron";
    default:
      return "";
  }
}

export default async function SitePage() {
  const [shop, { html, theme }, authed] = await Promise.all([
    getAllSettings(),
    getLandingContent(),
    isAuthenticated(),
  ]);

  return (
    <div
      className={`min-h-screen ${patternClass(theme.bgPattern)}`}
      style={{ backgroundColor: theme.pageBg }}
    >
      {/* Top bar */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur"
        style={{
          backgroundColor: theme.headerBg,
          borderColor: theme.headerBorder,
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <div
              className="text-lg font-bold"
              style={{ color: theme.headerText }}
            >
              {shop.shopName}
            </div>
            {shop.shopAddress && (
              <div
                className="text-xs whitespace-pre-line"
                style={{ color: theme.headerText, opacity: 0.7 }}
              >
                {shop.shopAddress}
              </div>
            )}
            {(shop.shopPhone || shop.shopEmail) && (
              <div
                className="text-xs"
                style={{ color: theme.headerText, opacity: 0.7 }}
              >
                {[shop.shopPhone, shop.shopEmail].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {authed ? (
              <>
                <Link
                  href="/site/edit"
                  className="rounded-md px-4 py-2 text-sm font-medium"
                  style={{
                    backgroundColor: theme.buttonBg,
                    color: theme.buttonText,
                  }}
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
                className="rounded-md px-4 py-2 text-sm font-medium"
                style={{
                  backgroundColor: theme.buttonBg,
                  color: theme.buttonText,
                }}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero section with shop details */}
      <section style={{ backgroundColor: theme.heroBg, color: theme.heroText }}>
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {shop.shopName}
          </h1>
          {shop.shopAddress && (
            <p
              className="mt-4 text-lg whitespace-pre-line"
              style={{ color: theme.heroSubtext }}
            >
              {shop.shopAddress}
            </p>
          )}
          <div
            className="mt-4 flex flex-wrap items-center justify-center gap-6"
            style={{ color: theme.heroSubtext }}
          >
            {shop.shopPhone && (
              <a
                href={`tel:${shop.shopPhone}`}
                className="flex items-center gap-2 hover:opacity-80"
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
                className="flex items-center gap-2 hover:opacity-80"
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

      {/* Custom content (rendered from rich text HTML) */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        {html ? (
          <div
            className="landing-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="text-center py-20">
            <div className="text-zinc-400 text-lg">
              {authed
                ? 'No content yet. Click "Edit page" to start writing.'
                : ""}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer
        className="border-t py-8"
        style={{
          backgroundColor: theme.footerBg,
          borderColor: theme.footerBorder,
        }}
      >
        <div
          className="mx-auto max-w-6xl px-6 text-center text-sm"
          style={{ color: theme.footerText }}
        >
          {shop.shopName}
        </div>
      </footer>
    </div>
  );
}
