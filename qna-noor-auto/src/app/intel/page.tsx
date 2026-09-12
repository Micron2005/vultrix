import Link from "next/link";
import { redirect } from "next/navigation";
import { canDelete } from "@/lib/permissions";
import {
  Card,
  CardHeader,
  Input,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { db } from "@/lib/db";
import type { CachedRecalls } from "@/lib/nhtsa";
import { requireOrgId, requireUser } from "@/lib/session";
import {
  loadCommunityFixes,
  loadComplaints,
  loadOwnFixes,
  loadRecalls,
  resolveSpec,
  type IntelComplaints,
  type IntelSpec,
  type KnownFix,
} from "@/lib/vehicleIntel";
import { formatMileage } from "@/lib/utils";
import { loadVehicleLinks } from "@/lib/vehicleLinks";
import { VehicleLinksCard } from "./VehicleLinks";

export const dynamic = "force-dynamic";

type SearchParams = {
  vin?: string;
  year?: string;
  make?: string;
  model?: string;
  engine?: string;
};

export default async function VehicleIntelPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const orgId = await requireOrgId();
  const user = await requireUser();
  if (user.accountType !== "AUTO_SHOP") redirect("/");

  const params = await searchParams;
  const spec = await resolveSpec(params);
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { shareFixes: true },
  });
  const shareFixes = org?.shareFixes === true;

  const [ownFixes, communityFixes, recalls, complaints, ownLinks, communityLinks] = spec
    ? await Promise.all([
        loadOwnFixes(orgId, spec),
        loadCommunityFixes(orgId, spec),
        loadRecalls(spec),
        loadComplaints(spec),
        loadVehicleLinks(orgId, spec, { community: false }),
        loadVehicleLinks(orgId, spec, { community: true }),
      ])
    : [[], [], null, null, [], []];

  return (
    <>
      <PageHeader
        title="Vehicle intel"
        description="Recalls, owner complaints and known fixes for any year/make/model."
      />
      <Card className="mb-6">
        <form method="get" className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-zinc-700">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Year</span>
            <Input name="year" inputMode="numeric" defaultValue={params.year ?? ""} placeholder="2012" />
          </label>
          <label className="text-sm text-zinc-700">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Make</span>
            <Input name="make" defaultValue={params.make ?? ""} placeholder="Honda" />
          </label>
          <label className="text-sm text-zinc-700">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Model</span>
            <Input name="model" defaultValue={params.model ?? ""} placeholder="Accord" />
          </label>
          <label className="text-sm text-zinc-700">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Engine (optional)</span>
            <Input name="engine" defaultValue={params.engine ?? ""} placeholder="2.4L" />
          </label>
          <label className="text-sm text-zinc-700">
            <span className="mb-1 block text-xs font-medium text-zinc-500">VIN (optional)</span>
            <Input name="vin" defaultValue={params.vin ?? ""} placeholder="17-character VIN" />
          </label>
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--vx-accent-600)] px-4 text-sm font-medium text-white hover:bg-[var(--vx-accent-700)]"
            >
              Search vehicle intel
            </button>
          </div>
        </form>
      </Card>

      {spec ? (
        <>
          <h2 className="mb-4 text-xl font-semibold text-zinc-900">
            {vehicleHeading(spec)}
          </h2>
          <div className="space-y-6">
            <KnownFixesCard
              title="Known fixes at your shop"
              fixes={ownFixes}
              empty={
                <>
                  <p>No notes or closed repair orders for this vehicle yet.</p>
                  <LinkButton
                    href={`/notes/new?${new URLSearchParams({
                      year: String(spec.year),
                      make: spec.make,
                      model: spec.model,
                      ...(spec.engine ? { engine: spec.engine } : {}),
                    }).toString()}`}
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                  >
                    Add a note
                  </LinkButton>
                </>
              }
            />

            <Card>
              <CardHeader title="Fixes from other Vultrix shops" />
              {!shareFixes ? (
                <div className="p-4 text-sm text-zinc-600">
                  <p>
                    Turn on sharing in{" "}
                    <Link href="/settings#vehicle-intel" className="underline">
                      Settings → Vehicle intel
                    </Link>{" "}
                    to see fixes from other shops. Your own shared notes and
                    closed tickets are anonymized (no customer, pricing or shop
                    details).
                  </p>
                </div>
              ) : (
                <KnownFixList
                  fixes={communityFixes}
                  empty="No shared fixes have been published for this vehicle yet."
                />
              )}
            </Card>

            <VehicleLinksCard
              ownLinks={ownLinks}
              communityLinks={communityLinks}
              spec={spec}
              shareFixes={shareFixes}
              canDelete={canDelete(user.role)}
            />

            <RecallsCard spec={spec} recalls={recalls} />
            <ComplaintsCard complaints={complaints} />
          </div>
        </>
      ) : (
        <Card>
          <div className="p-6 text-sm text-zinc-600">
            Enter a year, make, and model, or a 17-character VIN, to view
            vehicle intel.
          </div>
        </Card>
      )}
    </>
  );
}

function vehicleHeading(spec: IntelSpec) {
  return `${spec.year} ${spec.make} ${spec.model}${spec.engine ? ` · ${spec.engine}` : ""}`;
}

function KnownFixesCard({
  title,
  fixes,
  empty,
}: {
  title: string;
  fixes: KnownFix[];
  empty: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      {fixes.length > 0 ? (
        <KnownFixList fixes={fixes} empty="" />
      ) : (
        <div className="p-4 text-sm text-zinc-600">{empty}</div>
      )}
    </Card>
  );
}

function KnownFixList({
  fixes,
  empty,
}: {
  fixes: KnownFix[];
  empty: React.ReactNode;
}) {
  if (fixes.length === 0) {
    return <div className="p-4 text-sm text-zinc-600">{empty}</div>;
  }
  return (
    <div className="divide-y divide-zinc-200">
      {fixes.map((fix) => (
        <div key={`${fix.source}-${fix.id}`} className="p-4">
          {fix.href ? (
            <Link href={fix.href} className="font-semibold text-zinc-900 underline-offset-2 hover:underline">
              {fix.title}
            </Link>
          ) : (
            <div className="font-semibold text-zinc-900">
              {fix.title}
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                Shared
              </span>
            </div>
          )}
          <div className="mt-2 space-y-1 text-sm text-zinc-700">
            {fix.symptom && <LabeledFixLine label="Complaint" value={fix.symptom} />}
            {fix.cause && <LabeledFixLine label="Cause" value={fix.cause} />}
            {fix.fix && <LabeledFixLine label="Fix" value={fix.fix} />}
          </div>
          <div className="mt-3 text-xs text-zinc-500">
            {fixMeta(fix)}
          </div>
        </div>
      ))}
    </div>
  );
}

function LabeledFixLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="whitespace-pre-wrap">
      <span className="font-medium text-zinc-800">{label}:</span> {value}
    </div>
  );
}

function fixMeta(fix: KnownFix) {
  const parts = [fix.source === "ro" ? "RO" : "Note"];
  if (fix.year) parts.push(String(fix.year));
  if (fix.mileage != null) parts.push(`${formatMileage(fix.mileage)} mi`);
  if (fix.engine) parts.push(fix.engine);
  if (fix.laborHours != null) parts.push(`${fix.laborHours} hrs`);
  parts.push(
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(fix.date)),
  );
  return parts.join(" · ");
}

function RecallsCard({
  spec,
  recalls,
}: {
  spec: IntelSpec;
  recalls: CachedRecalls | null;
}) {
  return (
    <Card>
      <CardHeader title={`Recalls${recalls ? ` (${recalls.count})` : ""}`} />
      <div className="p-4 text-sm">
        {!recalls ? (
          <p className="text-zinc-500">No NHTSA recall data is available right now.</p>
        ) : recalls.count === 0 ? (
          <p className="text-zinc-600">
            No active recalls for {spec.year} {spec.make} {spec.model}.
          </p>
        ) : (
          <ul className="space-y-3">
            {recalls.recalls.map((recall) => (
              <li key={`${recall.NHTSACampaignNumber}-${recall.Component ?? ""}`} className="rounded-md border border-zinc-200 p-3">
                <div className="font-semibold text-zinc-900">
                  {recall.Component ?? "Recall"}
                </div>
                <div className="mt-0.5 font-mono text-xs text-zinc-500">
                  Campaign {recall.NHTSACampaignNumber}
                </div>
                {recall.Summary && <p className="mt-2 text-xs text-zinc-700"><b>Summary:</b> {recall.Summary}</p>}
                {recall.Remedy && <p className="mt-1 text-xs text-zinc-700"><b>Remedy:</b> {recall.Remedy}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function ComplaintsCard({ complaints }: { complaints: IntelComplaints | null }) {
  return (
    <Card>
      <CardHeader title="Owner complaints (NHTSA)" />
      <div className="p-4 text-sm">
        {!complaints ? (
          <p className="text-zinc-500">No NHTSA complaint data is available right now.</p>
        ) : (
          <>
            <p className="mb-4 text-zinc-700">
              {complaints.total} owner complaint{complaints.total === 1 ? "" : "s"}.
            </p>
            {complaints.groups.length === 0 ? (
              <p className="text-zinc-500">No component breakdown was reported.</p>
            ) : (
              <div className="space-y-4">
                {complaints.groups.map((group) => (
                  <details key={group.component} className="rounded-md border border-zinc-200 p-3">
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 font-medium text-zinc-800">{group.component}</span>
                        <span className="text-xs text-zinc-500">{group.count}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                        <div
                          className="h-full rounded-full bg-zinc-700"
                          style={{
                            width: `${Math.max(
                              4,
                              (group.count / Math.max(...complaints.groups.map((item) => item.count))) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </summary>
                    <ul className="mt-3 space-y-2 border-t border-zinc-200 pt-3 text-xs text-zinc-600">
                      {group.samples.map((sample) => (
                        <li key={`${group.component}-${sample.odiNumber}`}>
                          <div className="text-zinc-500">
                            ODI {sample.odiNumber}
                            {sample.dateOfIncident ? ` · ${sample.dateOfIncident}` : ""}
                            {sample.crash ? " · Crash" : ""}
                            {sample.fire ? " · Fire" : ""}
                          </div>
                          <div className="mt-0.5 text-zinc-700">{sample.summary || "No summary provided."}</div>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-zinc-500">
              Source: NHTSA, updated {new Date(complaints.fetchedAt).toLocaleDateString()}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
