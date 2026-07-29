import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { categoryScanUrl } from "@/lib/scanTokens";
import { PrintQrButton } from "../[id]/qr/PrintQrButton";

export const dynamic = "force-dynamic";

async function resolveOrigin(): Promise<string> {
  const hdrs = await headers();
  const forwardedHost = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const forwardedProto =
    hdrs.get("x-forwarded-proto") ??
    (forwardedHost.startsWith("localhost") ? "http" : "https");
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

/** Printable QR stickers for each distinct inventory category in the org. */
export default async function CategoryQrPage() {
  const orgId = await requireOrgId();
  const rows = await db.part.findMany({
    where: { orgId, category: { not: null }, archived: false },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const categories = rows
    .map((row) => row.category)
    .filter((category): category is string => Boolean(category));

  const counts = await db.part.groupBy({
    by: ["category"],
    where: { orgId, category: { not: null }, archived: false },
    _count: { _all: true },
  });
  const countByCategory = new Map<string, number>();
  for (const count of counts) {
    if (count.category) countByCategory.set(count.category, count._count._all);
  }

  const origin = await resolveOrigin();
  const stickers = await Promise.all(
    categories.map(async (category) => {
      const url = categoryScanUrl(origin, category);
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
      });
      return {
        category,
        url,
        svg,
        count: countByCategory.get(category) ?? 0,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Category QR ({stickers.length})
          </h1>
          <p className="text-sm text-zinc-500">
            One sticker per category. Scan it to search and adjust any part in
            that category.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory"
            className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
          >
            ← Inventory
          </Link>
          {stickers.length > 0 && <PrintQrButton />}
        </div>
      </div>

      {stickers.length === 0 ? (
        <div className="no-print rounded-md border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          No categories yet. Add a category to a part and it will appear here
          as a printable sticker.
        </div>
      ) : (
        <div className="sheet">
          {stickers.map((sticker) => (
            <div key={sticker.category} className="sticker">
              <div className="qr" dangerouslySetInnerHTML={{ __html: sticker.svg }} />
              <div className="info">
                <div className="category">{sticker.category}</div>
                <div className="count">
                  {sticker.count} {sticker.count === 1 ? "part" : "parts"}
                </div>
                <div className="hint">Scan to pick a part</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .sheet {
          display: grid;
          gap: 0.125in;
          grid-template-columns: repeat(2, 4in);
          justify-content: center;
          padding: 0.25in;
          background: #f4f4f5;
        }
        .sticker {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 0.15in;
          padding: 0.15in 0.18in;
          border: 1px dashed #d4d4d8;
          border-radius: 4px;
          background: #fff;
          height: 2.5in;
          overflow: hidden;
          box-sizing: border-box;
        }
        .sticker .qr { width: 2in; height: 2in; }
        .sticker .qr svg { width: 100%; height: 100%; display: block; }
        .sticker .info { min-width: 0; }
        .sticker .info .category {
          font-size: 18pt;
          font-weight: 700;
          line-height: 1.1;
          color: #18181b;
        }
        .sticker .info .count {
          font-size: 10pt;
          color: #3f3f46;
          margin-top: 4px;
        }
        .sticker .info .hint {
          font-size: 9pt;
          color: #a1a1aa;
          margin-top: 8px;
        }
        @media print {
          @page { size: letter; margin: 0.5in; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .sheet { background: #fff; padding: 0; }
          .sticker { border-color: transparent; }
        }
      `}</style>
    </div>
  );
}
