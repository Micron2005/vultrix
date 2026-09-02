import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/branding";
import { db } from "@/lib/db";
import {
  getStatusChecks,
  type StatusCheck,
  type StatusState,
} from "@/lib/status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Status — ${APP_NAME}`,
};

const stateLabels: Record<StatusState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  not_configured: "Not configured",
};

function formatUtc(date: Date): string {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function statePillClass(state: StatusState): string {
  if (state === "operational") return "bg-green-100 text-green-800";
  if (state === "degraded" || state === "not_configured") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-red-100 text-red-800";
}

function headlineFor(checks: StatusCheck[]): {
  label: string;
  className: string;
} {
  if (checks.some((check) => check.state === "down")) {
    return {
      label: "Major outage",
      className: "border-red-200 bg-red-50 text-red-900",
    };
  }
  if (
    checks.some(
      (check) =>
        check.state === "degraded" || check.state === "not_configured",
    )
  ) {
    return {
      label: "Some systems degraded",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }
  return {
    label: "All systems operational",
    className: "border-green-200 bg-green-50 text-green-900",
  };
}

async function incidents() {
  try {
    const [active, resolved] = await Promise.all([
      db.statusIncident.findMany({
        where: { state: { not: "RESOLVED" } },
        orderBy: [{ startsAt: "desc" }],
      }),
      db.statusIncident.findMany({
        where: { state: "RESOLVED" },
        orderBy: [{ resolvedAt: "desc" }, { startsAt: "desc" }],
        take: 5,
      }),
    ]);
    return { active, resolved };
  } catch {
    return { active: [], resolved: [] };
  }
}

function IncidentCard({
  incident,
  resolved,
}: {
  incident: {
    id: string;
    title: string;
    body: string;
    state: string;
    severity: string;
    startsAt: Date;
    resolvedAt: Date | null;
  };
  resolved?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-zinc-900">{incident.title}</h3>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
          {incident.severity === "MAINTENANCE"
            ? "Maintenance"
            : incident.severity === "MAJOR"
              ? "Major"
              : "Minor"}
        </span>
      </div>
      <div className="mt-1 text-xs text-zinc-500">
        {incident.state.charAt(0) + incident.state.slice(1).toLowerCase()} ·
        {" started "}
        {formatUtc(incident.startsAt)}
      </div>
      {incident.body && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
          {incident.body}
        </p>
      )}
      {resolved && incident.resolvedAt && (
        <div className="mt-3 text-xs text-zinc-500">
          Resolved {formatUtc(incident.resolvedAt)}
        </div>
      )}
    </div>
  );
}

export default async function StatusPage() {
  const checksPromise = getStatusChecks();
  const incidentsPromise = incidents();
  const [checks, incidentGroups] = await Promise.all([
    checksPromise,
    incidentsPromise,
  ]);
  const headline = headlineFor(checks);
  const checkedAt = new Date();

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="text-center">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tight text-zinc-900"
          >
            {APP_NAME}
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-zinc-800">Status</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Service health and incident updates
          </p>
        </header>

        <div className={`rounded-lg border px-5 py-4 ${headline.className}`}>
          <div className="text-lg font-semibold">{headline.label}</div>
          <div className="mt-1 text-sm opacity-80">
            Checked {formatUtc(checkedAt)}
          </div>
        </div>

        {incidentGroups.active.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
              Active incidents
            </h2>
            {incidentGroups.active.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </section>
        )}

        <Card>
          <CardHeader title="Systems" />
          <div className="divide-y divide-zinc-100">
            {checks.map((check) => (
              <div
                key={check.key}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <div className="font-medium text-zinc-900">{check.label}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {check.detail}
                    {check.latencyMs !== undefined &&
                      ` · ${check.latencyMs} ms`}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statePillClass(
                    check.state,
                  )}`}
                >
                  {stateLabels[check.state]}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {incidentGroups.resolved.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
              Resolved incidents
            </h2>
            {incidentGroups.resolved.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                resolved
              />
            ))}
          </section>
        )}

        <footer className="flex flex-col items-center gap-2 text-xs text-zinc-500">
          <div>
            <Link href="/" className="underline underline-offset-2">
              vultrix.net
            </Link>
            {" · "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="underline underline-offset-2"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
          <div>{APP_NAME} service status</div>
        </footer>
      </div>
    </div>
  );
}
