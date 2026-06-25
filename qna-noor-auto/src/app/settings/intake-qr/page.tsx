import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireOrgId } from "@/lib/session";
import { getAllSettings } from "@/lib/shop";
import { intakeUrl } from "@/lib/intakeTokens";
import { PrintIntakeButton } from "./PrintIntakeButton";

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
 * Printable poster carrying the shop's intake QR. Print it and post it in the
 * shop; techs scan it to start a new service ticket from their phone.
 */
export default async function IntakeQrPage() {
  const orgId = await requireOrgId();
  const settings = await getAllSettings(orgId);
  const origin = await resolveOrigin();
  const url = intakeUrl(origin, orgId);
  const shopName = settings.shopName || "Your shop";

  if (!url) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Shop intake QR</h1>
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          To enable the public intake QR, set an{" "}
          <code className="font-mono">INTAKE_SIGNING_SECRET</code> environment
          variable (any long random string) in your Vercel project, then
          redeploy.
        </div>
        <Link
          href="/settings"
          className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Back to settings
        </Link>
      </div>
    );
  }

  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="no-print mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Shop intake QR
          </h1>
          <p className="text-sm text-zinc-500">
            Print this and post it in the shop. Techs scan it to start a ticket
            from their phone — no login needed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            ← Back
          </Link>
          <PrintIntakeButton />
        </div>
      </div>

      <div className="intake-poster mx-auto rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <div className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
          {shopName}
        </div>
        <h2 className="mt-2 text-3xl font-bold text-zinc-900">
          Scan to start a service ticket
        </h2>
        <p className="mt-1 text-zinc-500">
          New here or a returning customer? Scan with your phone camera.
        </p>
        <div
          className="mx-auto mt-6 w-64"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="mt-4 break-all font-mono text-xs text-zinc-400">{url}</p>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, aside, header { display: none !important; }
          body { background: #fff !important; }
          .intake-poster { border: none !important; margin-top: 0 !important; }
        }
      `}</style>
    </div>
  );
}
