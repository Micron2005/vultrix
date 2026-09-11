"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Link2, Plus, Trash2, X } from "lucide-react";
import { Button, Card, CardHeader, Input, Textarea } from "@/components/ui";
import {
  addVehicleLink,
  deleteVehicleLink,
  type VehicleLinkActionResult,
} from "./actions";
import type { IntelSpec } from "@/lib/vehicleIntel";
import type {
  VehicleLinkItem,
  VehicleLinkPlatform,
} from "@/lib/vehicleLinks";

const platformLabels: Record<VehicleLinkPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  other: "Link",
};

const platformClasses: Record<VehicleLinkPlatform, string> = {
  youtube: "border-red-200 bg-red-50 text-red-800",
  tiktok: "border-cyan-200 bg-cyan-50 text-cyan-800",
  instagram: "border-pink-200 bg-pink-50 text-pink-800",
  other: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

export function VehicleLinksCard({
  ownLinks,
  communityLinks,
  spec,
  shareFixes,
  canDelete,
}: {
  ownLinks: VehicleLinkItem[];
  communityLinks: VehicleLinkItem[];
  spec: IntelSpec;
  shareFixes: boolean;
  canDelete: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Card>
      <CardHeader title="Videos & links">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setAdding((value) => !value)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add a link
        </Button>
      </CardHeader>
      {adding && (
        <AddVehicleLinkForm
          spec={spec}
          onCancel={() => setAdding(false)}
        />
      )}
      <div className="space-y-6 p-4">
        <LinkGroup
          title="From your shop"
          links={ownLinks}
          empty="No videos or links have been added for this vehicle yet."
          canDelete={canDelete}
        />
        <div className="border-t border-zinc-200 pt-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            From other Vultrix shops
          </h3>
          {!shareFixes ? (
            <p className="text-sm text-zinc-500">
              Turn on sharing above to see video links from other shops.
            </p>
          ) : (
            <LinkGroup
              links={communityLinks}
              empty="No shared videos or links have been published for this vehicle yet."
              canDelete={false}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function LinkGroup({
  title,
  links,
  empty,
  canDelete,
}: {
  title?: string;
  links: VehicleLinkItem[];
  empty: string;
  canDelete: boolean;
}) {
  return (
    <section>
      {title && (
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h3>
      )}
      {links.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <VehicleLinkCard
              key={`${link.community ? "community" : "own"}-${link.id}`}
              link={link}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VehicleLinkCard({
  link,
  canDelete,
}: {
  link: VehicleLinkItem;
  canDelete: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const remove = () => {
    if (!window.confirm("Delete this vehicle link?")) return;
    startTransition(async () => {
      const result = await deleteVehicleLink(link.id);
      if (result.ok) router.refresh();
    });
  };

  const content = (
    <>
      <div className="relative aspect-video overflow-hidden bg-zinc-100">
        {link.thumbnailUrl ? (
          <img
            src={link.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-full items-center justify-center border-b text-sm font-semibold ${platformClasses[link.platform]}`}
          >
            <Link2 className="mr-2 h-5 w-5" />
            {platformLabels[link.platform]}
          </div>
        )}
        {link.embedUrl && (
          <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[11px] font-medium text-white">
            Play video
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="line-clamp-2 font-semibold text-zinc-900">{link.title}</div>
        {link.notes && (
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{link.notes}</p>
        )}
        <div className="mt-3 text-xs text-zinc-500">
          {platformLabels[link.platform]} · {linkScope(link)}
          {" · "}
          {link.community ? "Shared by another shop" : "Added by your shop"}
        </div>
        {link.community && (
          <span className="mt-2 inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            Shared
          </span>
        )}
      </div>
    </>
  );

  return (
    <>
      <article className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        {link.embedUrl ? (
          <button
            type="button"
            className="block w-full text-left"
            onClick={() => setModalOpen(true)}
          >
            {content}
          </button>
        ) : (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="block text-left"
          >
            {content}
          </a>
        )}
        {canDelete && !link.community && (
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            aria-label={`Delete ${link.title}`}
            className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-zinc-600 shadow-sm hover:bg-white hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </article>
      {modalOpen && link.embedUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={link.title}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-lg bg-zinc-900 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Close video"
              className="absolute right-2 top-2 z-10 rounded-md bg-zinc-900/80 p-2 text-zinc-200 hover:bg-zinc-800"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="aspect-video">
              <iframe
                src={link.embedUrl}
                title={link.title}
                className="h-full w-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function linkScope(link: VehicleLinkItem) {
  if (link.yearMin != null && link.yearMax != null) {
    return link.yearMin === link.yearMax
      ? String(link.yearMin)
      : `${link.yearMin}–${link.yearMax}`;
  }
  if (link.yearMin != null) return `${link.yearMin}+`;
  if (link.yearMax != null) return `up to ${link.yearMax}`;
  return "All years";
}

function AddVehicleLinkForm({
  spec,
  onCancel,
}: {
  spec: IntelSpec;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  const submit = (formData: FormData) => {
    setError("");
    startTransition(async () => {
      const result: VehicleLinkActionResult = await addVehicleLink(formData);
      if (!result.ok) {
        setError(result.error ?? "Unable to add link.");
        return;
      }
      onCancel();
      router.refresh();
    });
  };

  return (
    <form action={submit} className="space-y-4 border-b border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-zinc-700">
          <span className="mb-1 block text-xs font-medium text-zinc-500">URL</span>
          <Input name="url" type="url" required placeholder="https://www.youtube.com/watch?v=..." />
        </label>
        <label className="text-sm text-zinc-700">
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            What did it help with?
          </span>
          <Input name="title" required maxLength={120} />
        </label>
      </div>
      <label className="block text-sm text-zinc-700">
        <span className="mb-1 block text-xs font-medium text-zinc-500">Notes (optional)</span>
        <Textarea name="notes" rows={2} maxLength={2_000} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm text-zinc-700">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Year from</span>
          <Input name="yearMin" inputMode="numeric" defaultValue={spec.year} />
        </label>
        <label className="text-sm text-zinc-700">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Year to</span>
          <Input name="yearMax" inputMode="numeric" defaultValue={spec.year} />
        </label>
        <label className="text-sm text-zinc-700">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Make</span>
          <Input name="make" defaultValue={spec.make} />
        </label>
        <label className="text-sm text-zinc-700">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Model</span>
          <Input name="model" defaultValue={spec.model} />
        </label>
        <label className="text-sm text-zinc-700">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Engine</span>
          <Input name="engine" defaultValue={spec.engine ?? ""} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="shared"
          value="true"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-zinc-300"
        />
        <span>
          Share with other shops (when sharing is on)
          <span className="mt-1 block text-xs text-zinc-500">
            Shared links include only the link and vehicle tags.
          </span>
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add link"}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
