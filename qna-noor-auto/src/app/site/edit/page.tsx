import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllSettings } from "@/lib/shop";
import { isAuthenticated } from "@/lib/auth";
import { getLandingContent } from "../actions";
import { RichTextEditor } from "../RichTextEditor";

export const dynamic = "force-dynamic";

export default async function SiteEditPage() {
  if (!(await isAuthenticated())) {
    redirect("/login?next=/site/edit");
  }

  const [shop, html] = await Promise.all([
    getAllSettings(),
    getLandingContent(),
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
            <div className="text-xs text-zinc-500">Editing landing page</div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/site"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              View live page
            </Link>
            <Link
              href="/"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <RichTextEditor initialHtml={html} />
      </section>
    </div>
  );
}
