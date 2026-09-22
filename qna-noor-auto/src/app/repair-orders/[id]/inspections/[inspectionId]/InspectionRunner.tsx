"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fileToResizedDataUrl } from "@/lib/imageResize";
import type { InspectionRunnerData, Rating } from "@/lib/inspections";

export type InspectionRunnerActions = {
  rate: (itemId: string, rating: Rating) => Promise<void>;
  note: (itemId: string, note: string) => Promise<void>;
  addPhotos: (itemId: string, dataUrls: string[]) => Promise<void>;
  deletePhoto: (photoId: string) => Promise<void>;
  setTechnician: (
    inspectionId: string,
    technicianId: string | null,
  ) => Promise<void>;
  setSummary: (inspectionId: string, text: string) => Promise<void>;
  complete: (inspectionId: string) => Promise<void>;
  reopen: (inspectionId: string) => Promise<void>;
  addJob?: (itemId: string) => Promise<void>;
  send?: (
    inspectionId: string,
  ) => Promise<{
    emailed: boolean;
    reason: "sent" | "no_email" | "email_not_configured";
  }>;
  delete?: (inspectionId: string) => Promise<void>;
};

const ratingStyles: Record<string, string> = {
  GOOD: "border-emerald-300 bg-emerald-50 text-emerald-800",
  ATTENTION: "border-amber-300 bg-amber-50 text-amber-800",
  URGENT: "border-red-300 bg-red-50 text-red-800",
  NA: "border-zinc-300 bg-zinc-100 text-zinc-700",
};
const ratingNames: Record<string, string> = { GOOD: "Good", ATTENTION: "Attention", URGENT: "Urgent", NA: "N/A" };

export function InspectionRunner({
  data,
  technicians,
  actions,
  backHref,
  backLabel,
  finishHref,
}: {
  data: InspectionRunnerData;
  technicians: Array<{ id: string; name: string }>;
  actions: InspectionRunnerActions;
  backHref: string;
  backLabel: string;
  finishHref?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(data.items);
  const [summary, setSummary] = useState(data.summary);
  const [technicianId, setTechnicianId] = useState(data.technicianId ?? "");
  const [status, setStatus] = useState(data.status);
  const [sentAt, setSentAt] = useState(data.sentAt);
  const [sendReason, setSendReason] = useState(data.sendReason);
  const [busy] = useTransition();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) map.set(item.section, [...(map.get(item.section) ?? []), item]);
    return [...map.entries()];
  }, [items]);
  const counts = {
    checked: items.filter((item) => item.rating != null).length,
    good: items.filter((item) => item.rating === "GOOD").length,
    attention: items.filter((item) => item.rating === "ATTENTION").length,
    urgent: items.filter((item) => item.rating === "URGENT").length,
  };
  function mutateItem(id: string, patch: Partial<(typeof items)[number]>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
  async function setRating(id: string, rating: Rating) {
    const old = items.find((item) => item.id === id)?.rating ?? null;
    mutateItem(id, { rating });
    try { await actions.rate(id, rating); } catch { mutateItem(id, { rating: old }); }
  }
  function queueNote(id: string, note: string) {
    mutateItem(id, { note });
    const old = timers.current.get(id);
    if (old) clearTimeout(old);
    timers.current.set(id, setTimeout(() => {
      void actions.note(id, note).catch(() => {});
    }, 500));
  }
  async function addPhotos(id: string, files: FileList | null) {
    if (!files?.length) return;
    const urls = await Promise.all(Array.from(files).slice(0, 6).map(fileToResizedDataUrl));
    const item = items.find((current) => current.id === id);
    if (!item) return;
    mutateItem(id, { photos: [...item.photos, ...urls.map((dataUrl, index) => ({ id: `pending-${Date.now()}-${index}`, dataUrl }))] });
    try { await actions.addPhotos(id, urls); router.refresh(); } catch { router.refresh(); }
  }
  async function addJob(id: string) {
    if (!actions.addJob) return;
    mutateItem(id, { jobId: "pending" });
    try { await actions.addJob(id); router.refresh(); } catch { mutateItem(id, { jobId: null }); }
  }
  async function complete() {
    const unchecked = items.length - counts.checked;
    if (unchecked > 0 && !window.confirm(`${unchecked} item${unchecked === 1 ? "" : "s"} unchecked — complete anyway?`)) return;
    await actions.complete(data.id);
    setStatus("COMPLETED");
    router.refresh();
  }
  async function send() {
    if (!actions.send) return;
    const result = await actions.send(data.id);
    setSentAt(new Date().toISOString());
    setSendReason(result.reason);
  }
  const portalLink = data.portalToken ? `/p/${data.portalToken}/ro/${data.repairOrderId}/inspection/${data.id}` : null;
  return (
    <main className="min-h-screen bg-zinc-50 pb-24">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={backHref} className="text-xs text-zinc-500 hover:underline">{backLabel}</Link>
              <h1 className="truncate text-lg font-semibold text-zinc-900">{data.templateName}</h1>
              <p className="truncate text-xs text-zinc-500">{data.vehicle} · {counts.checked} / {items.length} checked</p>
            </div>
            <select value={technicianId} onChange={(e) => { const next = e.target.value; setTechnicianId(next); void actions.setTechnician(data.id, next || null); }} className="h-10 max-w-[145px] rounded-md border border-zinc-300 bg-white px-2 text-sm">
              <option value="">Technician</option>
              {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
            </select>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium">
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Good {counts.good}</span>
            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Attention {counts.attention}</span>
            <span className="rounded-full bg-red-100 px-2 py-1 text-red-800">Urgent {counts.urgent}</span>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {groups.map(([section, sectionItems]) => (
          <section key={section} className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <h2 className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-800">{section}</h2>
            <div className="divide-y divide-zinc-200">
              {sectionItems.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="font-medium text-zinc-900">{item.name}</div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {(["GOOD", "ATTENTION", "URGENT", "NA"] as const).map((rating) => (
                      <button key={rating} type="button" onClick={() => void setRating(item.id, item.rating === rating ? null : rating)} className={`min-h-11 rounded-md border px-1 text-xs font-semibold ${item.rating === rating ? ratingStyles[rating] : "border-zinc-200 bg-white text-zinc-500"}`}>{ratingNames[rating]}</button>
                    ))}
                  </div>
                  {(item.rating === "ATTENTION" || item.rating === "URGENT") ? (
                    <div className="mt-3 space-y-3">
                      <textarea value={item.note} onChange={(e) => queueNote(item.id, e.target.value)} maxLength={500} rows={2} placeholder="What did you find?" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
                      <PhotoTools item={item} onFiles={(files) => void addPhotos(item.id, files)} onDelete={(photoId) => { void actions.deletePhoto(photoId).then(() => router.refresh()); }} />
                      {actions.addJob ? <button type="button" disabled={Boolean(item.jobId) || busy} onClick={() => void addJob(item.id)} className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-50 disabled:opacity-60">{item.jobId ? "Job added ✓" : "Add as job"}</button> : null}
                    </div>
                  ) : (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-zinc-500">Add note / photo</summary>
                      <div className="mt-2 space-y-3">
                        <textarea value={item.note} onChange={(e) => queueNote(item.id, e.target.value)} maxLength={500} rows={2} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
                        <PhotoTools item={item} onFiles={(files) => void addPhotos(item.id, files)} onDelete={(photoId) => { void actions.deletePhoto(photoId).then(() => router.refresh()); }} />
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <label className="text-sm font-medium text-zinc-800">Note to customer<textarea value={summary} onChange={(e) => setSummary(e.target.value)} onBlur={() => { void actions.setSummary(data.id, summary); }} maxLength={1000} rows={4} placeholder="A short summary for the customer…" className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" /></label>
          <div className="mt-4 flex flex-wrap gap-2">
            {status !== "COMPLETED" ? <button type="button" onClick={() => void complete()} className="rounded-md bg-[var(--vx-accent-600)] px-4 py-2 text-sm font-semibold text-white">Mark complete</button> : (
              <>
                {finishHref ? <Link href={finishHref} className="w-full rounded-md bg-[var(--vx-accent-600)] px-4 py-2 text-center text-sm font-semibold text-white sm:w-auto">Done — next vehicle</Link> : null}
                {actions.send ? <button type="button" onClick={() => void send()} className="rounded-md bg-[var(--vx-accent-600)] px-4 py-2 text-sm font-semibold text-white">Send to customer</button> : null}
                <button type="button" onClick={() => { void actions.reopen(data.id); setStatus("IN_PROGRESS"); setSentAt(null); }} className="rounded-md border border-zinc-300 px-4 py-2 text-sm">Reopen</button>
              </>
            )}
            {actions.delete ? <form action={actions.delete.bind(null, data.id)} onSubmit={(event) => { if (!confirm("Delete this inspection? Photos and ratings will be lost.")) event.preventDefault(); }}><button type="submit" className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-700">Delete</button></form> : null}
          </div>
          {status === "COMPLETED" && sentAt && <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Sent {new Date(sentAt).toLocaleDateString()} · {data.portalToken ? "portal link ready" : "customer has no portal link"}{sendReason === "sent" && data.customerEmail ? ` · Emailed to ${data.customerEmail}` : sendReason === "no_email" ? " · Customer has no email — share the portal link" : sendReason === "email_not_configured" ? " · Email isn't set up for this shop — share the portal link" : ""}</div>}
          {status === "COMPLETED" && sentAt && portalLink && <div className="mt-2 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded bg-zinc-100 px-2 py-1 text-xs">{portalLink}</code><button type="button" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${portalLink}`)} className="rounded border border-zinc-300 px-2 py-1 text-xs">Copy portal link</button></div>}
        </section>
      </div>
    </main>
  );
}

function PhotoTools({ item, onFiles, onDelete }: { item: InspectionRunnerData["items"][number]; onFiles: (files: FileList | null) => void; onDelete: (id: string) => void }) {
  return (
    <div className="space-y-2">
      {item.photos.length > 0 && <div className="grid grid-cols-4 gap-2">{item.photos.map((photo) => <div key={photo.id} className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.dataUrl} alt="" className="h-16 w-full rounded object-cover" />
      <button type="button" onClick={() => onDelete(photo.id)} className="absolute right-0 top-0 rounded bg-black/70 px-1 text-xs text-white">×</button></div>)}</div>}
      {item.photos.length < 6 && <label className="inline-flex cursor-pointer rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Add photo<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} /></label>}
    </div>
  );
}
