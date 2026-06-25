import { headers } from "next/headers";
import QRCode from "qrcode";
import {
  Wrench,
  FileText,
  ScanLine,
  Car,
  Boxes,
  Bell,
  CreditCard,
  Users,
  Check,
  HardHat,
  Mail,
  Phone,
  Globe,
} from "lucide-react";
import { APP_NAME } from "@/lib/branding";
import { PRICE_USD, TRIAL_DAYS } from "@/lib/billing";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

// Owner contact details printed on the flyer.
const CONTACT_EMAIL = "micron.alam18@gmail.com";
const CONTACT_PHONE = "571-320-9425";

const FEATURES = [
  { icon: Wrench, text: "Repair orders, estimates & invoices" },
  { icon: ScanLine, text: "On-the-go ticket intake — techs start tickets from their phone" },
  { icon: CreditCard, text: "Customers approve & pay from their phone" },
  { icon: Boxes, text: "Inventory with QR shelf labels" },
  { icon: Car, text: "VIN / plate lookup + recalls" },
  { icon: Users, text: "Customer & vehicle history" },
  { icon: Bell, text: "Service reminders to win back customers" },
  { icon: FileText, text: "Unlimited repair orders — price never changes" },
];

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
 * Printable marketing flyer / sell-sheet for shop owners. Public (no login) so
 * it can be shared, posted, or left at a parts counter. Includes a QR code that
 * links straight to the free-trial signup.
 */
export default async function FlyerPage() {
  const origin = await resolveOrigin();
  const base = origin || "https://vultrix.net";
  const signupUrl = `${base}/signup`;
  const siteLabel = base.replace(/^https?:\/\//, "");

  const qrSvg = await QRCode.toString(signupUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-8 print:bg-white print:p-0">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print mx-auto mb-6 flex max-w-[820px] items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-extrabold text-zinc-900">
            {APP_NAME} flyer
          </h1>
          <p className="text-sm text-zinc-500">
            Print it, post it, or hand it out. Tip: print at 100% scale.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* The flyer sheet */}
      <div
        className="mx-auto flex max-w-[820px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg print:max-w-none print:rounded-none print:border-0 print:shadow-none"
        data-testid="flyer-sheet"
      >
        {/* Header band */}
        <div className="relative overflow-hidden bg-zinc-950 px-10 py-8 text-white">
          <div className="flex items-center justify-between">
            <div className="font-display text-2xl font-extrabold tracking-tight">
              {APP_NAME}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
              <HardHat className="h-3.5 w-3.5" /> Built by a working mechanic
            </div>
          </div>
          <h2 className="mt-6 max-w-2xl font-display text-4xl font-extrabold leading-tight tracking-tight">
            Run your whole shop for{" "}
            <span className="text-amber-400">${PRICE_USD}/month</span> — flat.
          </h2>
          <p className="mt-3 text-lg text-zinc-300">
            Built by a shop owner, for shop owners. One simple price, every tool
            included.
          </p>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-8 px-10 py-9 sm:grid-cols-5">
          {/* Feature checklist */}
          <div className="sm:col-span-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Everything in one place
            </div>
            <ul className="mt-4 space-y-3">
              {FEATURES.map((f) => (
                <li key={f.text} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="text-[15px] font-medium text-zinc-800">
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm text-zinc-500 line-through">
                $150–$400+ / month elsewhere
              </div>
              <div className="font-display text-lg font-extrabold text-zinc-900">
                One flat ${PRICE_USD}/month · no contract · cancel anytime
              </div>
            </div>
          </div>

          {/* QR + trial */}
          <div className="sm:col-span-2">
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-6 text-center">
              <div className="font-display text-base font-extrabold text-zinc-900">
                Scan to start your
              </div>
              <div className="font-display text-2xl font-extrabold text-amber-600">
                {TRIAL_DAYS}-day free trial
              </div>
              <div
                className="mx-auto mt-4 w-40 [&_svg]:h-full [&_svg]:w-full"
                aria-label="Scan to sign up"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700">
                <Globe className="h-4 w-4" /> {siteLabel}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                No card charged until the trial ends.
              </div>
            </div>
          </div>
        </div>

        {/* Contact footer band */}
        <div className="mt-auto flex flex-col items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-950 px-10 py-5 text-white sm:flex-row">
          <div className="font-display text-sm font-bold">
            Questions? Let&apos;s talk.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-2 text-zinc-200 hover:text-white"
              data-testid="flyer-email"
            >
              <Mail className="h-4 w-4 text-amber-400" /> {CONTACT_EMAIL}
            </a>
            <a
              href={`tel:${CONTACT_PHONE.replace(/[^0-9]/g, "")}`}
              className="inline-flex items-center gap-2 text-zinc-200 hover:text-white"
              data-testid="flyer-phone"
            >
              <Phone className="h-4 w-4 text-amber-400" /> {CONTACT_PHONE}
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 0.4in; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
