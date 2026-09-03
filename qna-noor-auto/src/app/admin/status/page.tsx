import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import {
  createStatusIncident,
  resolveStatusIncident,
  updateStatusIncident,
} from "../actions";
import { DeleteStatusIncident } from "./DeleteStatusIncident";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  "incident-created": "Status incident posted.",
  "incident-updated": "Status incident updated.",
  "incident-resolved": "Status incident resolved.",
  "incident-deleted": "Status incident deleted.",
};

const INCIDENT_STATES = [
  ["INVESTIGATING", "Investigating"],
  ["IDENTIFIED", "Identified"],
  ["MONITORING", "Monitoring"],
  ["RESOLVED", "Resolved"],
  ["MAINTENANCE", "Maintenance"],
] as const;
const INCIDENT_SEVERITIES = [
  ["MINOR", "Minor"],
  ["MAJOR", "Major"],
  ["MAINTENANCE", "Maintenance"],
] as const;

export default async function StatusPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; error?: string }>;
}) {
  await requireSuperadmin();
  const sp = (await searchParams) ?? {};
  const incidents = await db.statusIncident.findMany({
    orderBy: [{ state: "asc" }, { startsAt: "desc" }],
  });

  return (
    <div>
      <PageHeader
        title="Status page"
        description={
          <>
            Post and update incidents shown on the public status page.{" "}
            <Link href="/status" className="text-zinc-900 underline">
              View public status page
            </Link>
          </>
        }
      />

      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.notice && NOTICES[sp.notice] && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {NOTICES[sp.notice]}
        </div>
      )}

      <Card>
        <CardHeader title={`Status page (${incidents.length})`} />
        <form action={createStatusIncident} className="space-y-3 p-4">
          <Field label="Title">
            <Input name="title" required placeholder="e.g. Elevated response times" />
          </Field>
          <Field label="Details">
            <Textarea
              name="body"
              rows={3}
              placeholder="What is happening and what customers should know"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Severity">
              <Select name="severity" defaultValue="MINOR">
                {INCIDENT_SEVERITIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="State">
              <Select name="state" defaultValue="INVESTIGATING">
                {INCIDENT_STATES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit">Post incident</Button>
        </form>
        {incidents.length > 0 && (
          <div className="divide-y divide-zinc-100 border-t border-zinc-200">
            {incidents.map((incident) => (
              <div key={incident.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-zinc-900">
                      {incident.title}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {incident.severity} · {incident.state}
                    </div>
                  </div>
                  <DeleteStatusIncident id={incident.id} />
                </div>
                {incident.body && (
                  <p className="whitespace-pre-wrap text-sm text-zinc-600">
                    {incident.body}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <form action={updateStatusIncident} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={incident.id} />
                    <Select name="state" defaultValue={incident.state}>
                      {INCIDENT_STATES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="secondary" size="sm">
                      Update state
                    </Button>
                  </form>
                  {incident.state !== "RESOLVED" && (
                    <form action={resolveStatusIncident}>
                      <input type="hidden" name="id" value={incident.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Resolve
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
