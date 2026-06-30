import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { locationScanUrl } from "@/lib/scanTokens";
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

/**
 * Printable QR stickers for shelves/bins — one per distinct Part.location in
 * the org. Stick each on its shelf; scanning opens /sl/<location> where a tech
 * picks the exact part they used. Lets many small SKUs share a single sticker.
 */
export default async function BinQrPage() {
  const orgId = await requireOrgId();

  const rows = await db.part.findMany({
    where: { orgId, location: { not: null }, archived: false },
    select: { location: true },
    distinct: ["location"],
    orderBy: { location: "asc" },
  });
  const locations = rows
    .map((r) => r.location)
    .filter((l): l is string => Boolean(l));

  // Count parts per location so the sticker can show "12 parts".
  const counts = await db.part.groupBy({
    by: ["location"],
    where: { orgId, location: { not: null }, archived: false },
    _count: { _all: true },
  });
  const countByLoc = new Map<string, number>();
  for (const c of counts) {
    if (c.location) countByLoc.set(c.location, c._count._all);
  }

  const origin = await resolveOrigin();
  const stickers = await Promise.all(
    locations.map(async (loc) => {
      const url = locationScanUrl(origin, loc);
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
      });
      return { loc, url, svg, count: countByLoc.get(loc) ?? 0 };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Shelf / bin QR ({stickers.length})
          </h1>
          <p className="text-sm text-zinc-500">
            One sticker per location. Stick it on the shelf; scan it to see
            every part stored there and tap what you used — no need to label
            each small part individually.
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
          No locations yet. Open a part, set its{" "}
          <span className="font-medium">Location / bin</span> (e.g. &ldquo;Shelf
          B3&rdquo;), and it will appear here as a printable shelf sticker.
        </div>
      ) : (
        <div className="sheet">
          {stickers.map((s) => (
            <div key={s.loc} className="sticker">
              <div className="qr" dangerouslySetInnerHTML={{ __html: s.svg }} />
              <div className="info">
                <div className="loc">{s.loc}</div>
                <div className="count">
                  {s.count} {s.count === 1 ? "part" : "parts"}
                </div>
                <div className="hint">Scan to pick what you used</div>
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
        .sticker .info .loc {
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
