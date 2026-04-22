import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
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
 * Bulk QR-sticker sheet. Lays out many Part stickers on one printable page
 * so the user can send a full label sheet to the printer at once.
 *
 * Query params:
 *   - `ids`   comma-separated Part ids (priority)
 *   - `filter` "low" | "out" | "all"  — otherwise defaults to all active
 *   - `q`     search string (matches name / partNumber / source)
 *   - `size`  "large" (6/page @ 4"x2") | "small" (20/page @ 2"x1", default)
 */
export default async function QrSheetPage({
  searchParams,
}: {
  searchParams: Promise<{
    ids?: string;
    filter?: string;
    q?: string;
    size?: string;
  }>;
}) {
  const sp = await searchParams;
  const idList = (sp.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const filter =
    sp.filter === "low" || sp.filter === "out" || sp.filter === "all"
      ? sp.filter
      : "active";
  const q = (sp.q ?? "").trim();
  const size = sp.size === "large" ? "large" : "small";

  const where: Record<string, unknown> = {};
  if (idList.length > 0) {
    where.id = { in: idList };
  } else {
    // "all" keeps archived parts; every other filter excludes them.
    if (filter !== "all") where.archived = false;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { partNumber: { contains: q } },
        { source: { contains: q } },
      ];
    }
  }

  let parts = await db.part.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      partNumber: true,
      source: true,
      qtyOnHand: true,
      reorderLevel: true,
    },
  });

  if (idList.length === 0) {
    if (filter === "low") {
      parts = parts.filter(
        (p) => p.qtyOnHand <= p.reorderLevel && p.qtyOnHand > 0,
      );
    } else if (filter === "out") {
      parts = parts.filter((p) => p.qtyOnHand <= 0);
    }
    // "active" and "all" both keep the query result as-is (archived is
    // already excluded when no explicit ids were provided).
  }

  const origin = await resolveOrigin();

  const qrCodes = await Promise.all(
    parts.map(async (p) => {
      const url = origin ? `${origin}/s/${p.id}` : `/s/${p.id}`;
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
      });
      return { ...p, svg, url };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            QR sticker sheet ({qrCodes.length})
          </h1>
          <p className="text-sm text-zinc-500">
            Print onto a blank label sheet (Avery 5163 for large, Avery 5160
            for small). Each sticker scans straight to the part&apos;s stock
            page.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory"
            className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
          >
            ← Inventory
          </Link>
          <PrintQrButton />
        </div>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white p-3 text-sm">
        <span className="text-zinc-500">Size:</span>
        <Link
          href={{ pathname: "/inventory/qr-sheet", query: { ...sp, size: "small" } }}
          className={`px-2 py-1 rounded ${
            size === "small"
              ? "bg-zinc-900 text-white"
              : "border border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          Small (20/page, 2.625×1&quot;)
        </Link>
        <Link
          href={{ pathname: "/inventory/qr-sheet", query: { ...sp, size: "large" } }}
          className={`px-2 py-1 rounded ${
            size === "large"
              ? "bg-zinc-900 text-white"
              : "border border-zinc-300 hover:bg-zinc-50"
          }`}
        >
          Large (6/page, 4×3.33&quot;)
        </Link>
        <span className="ml-4 text-zinc-500">Show:</span>
        {[
          { key: "active", label: "Active" },
          { key: "low", label: "Low stock" },
          { key: "out", label: "Out of stock" },
          { key: "all", label: "All (incl. archived)" },
        ].map((f) => (
          <Link
            key={f.key}
            href={{
              pathname: "/inventory/qr-sheet",
              query: { size, filter: f.key, ...(q ? { q } : {}) },
            }}
            className={`px-2 py-1 rounded ${
              filter === f.key
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {qrCodes.length === 0 ? (
        <div className="rounded-md border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          No parts match this filter.
        </div>
      ) : (
        <div className={`sheet sheet-${size}`}>
          {qrCodes.map((p) => (
            <div key={p.id} className="sticker">
              <div
                className="qr"
                dangerouslySetInnerHTML={{ __html: p.svg }}
              />
              <div className="info">
                <div className="name">{p.name}</div>
                {p.partNumber && <div className="num">#{p.partNumber}</div>}
                {p.source && <div className="src">{p.source}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .sheet {
          display: grid;
          gap: 0.125in;
          justify-content: center;
          padding: 0.25in;
          background: #f4f4f5;
        }
        .sheet-large { grid-template-columns: repeat(2, 4in); }
        .sheet-small { grid-template-columns: repeat(3, 2.625in); }
        .sticker {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 0.1in;
          padding: 0.1in 0.12in;
          border: 1px dashed #d4d4d8;
          border-radius: 4px;
          background: #fff;
          overflow: hidden;
          box-sizing: border-box;
        }
        .sheet-large .sticker { height: 3.33in; }
        .sheet-small .sticker { height: 1in; }
        .sheet-large .sticker .qr { width: 2.2in; height: 2.2in; }
        .sheet-small .sticker .qr { width: 0.85in; height: 0.85in; }
        .sticker .qr svg { width: 100%; height: 100%; display: block; }
        .sticker .info { min-width: 0; }
        .sticker .info .name {
          font-weight: 700;
          line-height: 1.1;
          color: #18181b;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .sheet-large .sticker .info .name { font-size: 14pt; }
        .sheet-small .sticker .info .name { font-size: 8pt; }
        .sticker .info .num {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: #3f3f46;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sheet-large .sticker .info .num { font-size: 10pt; }
        .sheet-small .sticker .info .num { font-size: 6pt; }
        .sticker .info .src {
          color: #71717a;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sheet-large .sticker .info .src { font-size: 9pt; }
        .sheet-small .sticker .info .src { font-size: 6pt; }
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
