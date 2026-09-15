import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAllSettings, shopBranding, shopBrandStyle } from "@/lib/shop";
import { formatDate, vehicleLabel } from "@/lib/utils";
import { InspectionPhotoViewer } from "./InspectionPhotoViewer";

export const dynamic = "force-dynamic";

export default async function PortalInspectionPage({ params }: { params: Promise<{ token: string; roId: string; inspectionId: string }> }) {
  const { token, roId, inspectionId } = await params;
  const customer = await db.customer.findUnique({ where: { portalToken: token }, select: { id: true } });
  if (!customer) notFound();
  const inspection = await db.inspection.findFirst({
    where: { id: inspectionId, repairOrderId: roId, sentAt: { not: null }, repairOrder: { customerId: customer.id } },
    include: {
      technician: true,
      repairOrder: { include: { vehicle: true, customer: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { photos: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!inspection) notFound();
  const [settings, branding] = await Promise.all([getAllSettings(inspection.orgId), shopBranding(inspection.orgId)]);
  const urgent = inspection.items.filter((item) => item.rating === "URGENT");
  const attention = inspection.items.filter((item) => item.rating === "ATTENTION");
  const good = inspection.items.filter((item) => item.rating === "GOOD");
  const na = inspection.items.filter((item) => item.rating === "NA" || !item.rating);
  return (
    <div className="min-h-screen bg-zinc-100 py-8" data-force-light style={shopBrandStyle(branding.accent)}>
      <div className="mx-auto max-w-3xl space-y-4 px-4">
        <Link href={`/p/${token}/ro/${roId}`} className="text-xs text-zinc-600 hover:underline print:hidden">← Back to repair order</Link>
        <article className="overflow-hidden rounded-lg bg-white shadow-sm">
          <header className="border-t-4 border-[var(--vx-accent-600)] border-b border-zinc-200 px-4 py-6 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {branding.logo && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={branding.logo} alt="" className="h-12 w-12 rounded object-contain" />
                  </>
                )}
                <div><div className="text-lg font-semibold text-zinc-900">{settings.shopName}</div><div className="text-xs text-zinc-500">Vehicle inspection report</div></div>
              </div>
              <div className="text-right text-xs text-zinc-500">RO #{inspection.repairOrder.roNumber}<br />{formatDate(inspection.sentAt)}</div>
            </div>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><div className="text-xs uppercase tracking-wider text-zinc-500">Vehicle</div><div className="font-medium text-zinc-900">{inspection.repairOrder.vehicle ? vehicleLabel(inspection.repairOrder.vehicle) : "Vehicle"}</div></div>
              <div><div className="text-xs uppercase tracking-wider text-zinc-500">Technician</div><div className="font-medium text-zinc-900">{inspection.technician?.name ?? "Your service team"}</div></div>
            </div>
          </header>
          <section className="grid grid-cols-3 gap-2 border-b border-zinc-200 px-4 py-4 sm:px-8">
            <SummaryChip label="Good" count={good.length} className="bg-emerald-100 text-emerald-800" />
            <SummaryChip label="Attention" count={attention.length} className="bg-amber-100 text-amber-800" />
            <SummaryChip label="Urgent" count={urgent.length} className="bg-red-100 text-red-800" />
          </section>
          {inspection.summary && <section className="border-b border-zinc-200 px-4 py-5 sm:px-8"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Note from the shop</div><p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">{inspection.summary}</p></section>}
          <ReportGroup title="Urgent" items={urgent} tone="red" />
          <ReportGroup title="Needs attention" items={attention} tone="amber" />
          <details className="border-t border-zinc-200" open={attention.length === 0 && urgent.length === 0}>
            <summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-zinc-800 sm:px-8">Show {good.length} items that passed</summary>
            <ReportGroup title="" items={good} tone="green" />
          </details>
          {na.length > 0 && <div className="border-t border-zinc-200 px-4 py-4 text-xs text-zinc-500">{na.length} item{na.length === 1 ? "" : "s"} not applicable or not rated.</div>}
        </article>
      </div>
    </div>
  );
}

function SummaryChip({ label, count, className }: { label: string; count: number; className: string }) {
  return <div className={`rounded-md px-3 py-2 text-center ${className}`}><div className="text-xl font-semibold tabular-nums">{count}</div><div className="text-[10px] font-semibold uppercase tracking-wider">{label}</div></div>;
}

function ReportGroup({ title, items, tone }: { title: string; items: Array<{ id: string; name: string; section: string; note: string | null; photos: Array<{ id: string; dataUrl: string }> }>; tone: "red" | "amber" | "green" }) {
  if (!items.length) return null;
  const bar = tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-400" : "bg-emerald-500";
  const groups = new Map<string, typeof items>();
  for (const item of items) groups.set(item.section, [...(groups.get(item.section) ?? []), item]);
  return <section className="border-t border-zinc-200 px-4 py-5 sm:px-8">{title && <h2 className="mb-3 text-sm font-semibold text-zinc-900">{title}</h2>}<div className="space-y-5">{[...groups.entries()].map(([section, sectionItems]) => <div key={section}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{section}</h3><div className="space-y-4">{sectionItems.map((item) => <div key={item.id} className="relative pl-3"><div className={`absolute bottom-0 left-0 top-0 w-1 rounded-full ${bar}`} /><div className="font-medium text-zinc-900">{item.name}</div>{item.note && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{item.note}</p>}{item.photos.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">{item.photos.map((photo) => <InspectionPhotoViewer key={photo.id} dataUrl={photo.dataUrl} />)}</div>}</div>)}</div></div>)}</div></section>;
}
