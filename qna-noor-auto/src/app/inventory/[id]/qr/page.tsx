import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { PrintQrButton } from "./PrintQrButton";

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
 * Single-part printable QR sticker. Produces a clean 4"×3" label ready to
 * send to a regular printer or a label printer. Clicking "Print sticker"
 * opens the browser print dialog; the CSS below strips the sidebar and
 * centers a single sticker on the printed page.
 */
export default async function PartQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const part = await db.part.findUnique({
    where: { id },
    select: { id: true, name: true, partNumber: true, source: true },
  });
  if (!part) notFound();

  const origin = await resolveOrigin();
  const scanUrl = origin ? `${origin}/s/${id}` : `/s/${id}`;

  // SVG stays crisp at any size, unlike the PNG data URL.
  const qrSvg = await QRCode.toString(scanUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="no-print mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">QR sticker</h1>
          <p className="text-sm text-zinc-500">
            Print this and stick it on the parts bin / box. Scan from your
            phone to adjust stock in one tap.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/inventory/${id}`}
            className="inline-flex items-center h-9 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white hover:bg-zinc-50"
          >
            ← Back
          </Link>
          <PrintQrButton />
        </div>
      </div>

      <div className="no-print mb-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        QR target: <span className="font-mono break-all">{scanUrl}</span>
      </div>

      <div className="print-sheet">
        <div className="sticker">
          <div
            className="qr"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="info">
            <div className="name">{part.name}</div>
            {part.partNumber && (
              <div className="num">#{part.partNumber}</div>
            )}
            {part.source && (
              <div className="src">{part.source}</div>
            )}
            <div className="hint">Scan to update stock</div>
          </div>
        </div>
      </div>

      <style>{`
        .print-sheet {
          display: flex;
          justify-content: center;
          padding: 24px 0;
        }
        .sticker {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          border: 2px solid #18181b;
          border-radius: 8px;
          background: #fff;
          width: 4in;
          min-height: 2.25in;
        }
        .sticker .qr { width: 2in; height: 2in; }
        .sticker .qr svg { width: 100%; height: 100%; display: block; }
        .sticker .info .name {
          font-size: 16pt;
          font-weight: 700;
          line-height: 1.15;
          color: #18181b;
        }
        .sticker .info .num {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 11pt;
          color: #3f3f46;
          margin-top: 4px;
        }
        .sticker .info .src {
          font-size: 10pt;
          color: #71717a;
          margin-top: 2px;
        }
        .sticker .info .hint {
          font-size: 9pt;
          color: #a1a1aa;
          margin-top: 8px;
        }
        @media print {
          @page { size: 4in 3in; margin: 0.125in; }
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-sheet { padding: 0 !important; }
          .sticker { border: none !important; }
        }
      `}</style>
    </div>
  );
}
