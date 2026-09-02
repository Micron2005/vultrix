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
import { ACTIVE_RO_WHERE, db } from "@/lib/db";
import { requireSuperadmin, roleLabel } from "@/lib/session";
import { APP_NAME } from "@/lib/branding";
import { describeBilling } from "@/lib/billing";
import {
  createBusiness,
  extendTrial,
  renameBusiness,
  setBusinessStatus,
  adminResetUserPassword,
  createStatusIncident,
  updateStatusIncident,
  resolveStatusIncident,
} from "./actions";
import { DeleteBusiness } from "./DeleteBusiness";
import { DeleteStatusIncident } from "./DeleteStatusIncident";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  created: "Account created.",
  suspended: "Account put on hold.",
  reactivated: "Account reactivated.",
  renamed: "Account renamed.",
  deleted: "Account deleted.",
  "trial-extended": "Free trial extended.",
  "password-reset": "Password updated. Share the new password with the owner.",
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

function accountTypeLabel(accountType: string): string {
  if (accountType === "PERSONAL") return "Personal";
  if (accountType === "BUSINESS") return "Business";
  return "Auto shop";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  await requireSuperadmin();
  const sp = (await searchParams) ?? {};

  const orgs = await db.organization.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          users: true,
          customers: true,
          repairOrders: { where: ACTIVE_RO_WHERE },
        },
      },
      users: {
        orderBy: { createdAt: "asc" },
        select: { id: true, username: true, role: true, isActive: true },
      },
    },
  });
  const incidents = await db.statusIncident.findMany({
    orderBy: [{ state: "asc" }, { startsAt: "desc" }],
  });

  return (
    <div>
      <PageHeader
        title="Manage accounts"
        description={`Platform controls for ${APP_NAME}. Create an account, put one on hold, or delete it.`}
      />

      {sp.error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.saved && NOTICES[sp.saved] && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          {NOTICES[sp.saved]}
        </div>
      )}

      <Card className="mb-6 max-w-2xl">
        <CardHeader title="Marketing flyer" />
        <div className="space-y-3 p-4">
          <p className="text-sm text-zinc-600">
            A print-ready, one-page flyer for selling Vultrix to other shops —
            features, price, and a QR code that takes them straight to a free
            trial, with your contact info on it. Open it, then print it or save
            it as a PDF to text or email.
          </p>
          <a
            href="/flyer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            data-testid="open-flyer"
          >
            Open printable flyer →
          </a>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader title="Add an account" />
          <form action={createBusiness} className="p-4 space-y-3">
            <Field label="Account name">
              <div className="space-y-1">
                <Input name="name" required placeholder="e.g. Drive Nation Auto" />
                <p className="text-xs text-zinc-500">
                  The business name, or the person&apos;s full name for a
                  personal account.
                </p>
              </div>
            </Field>
            <Field label="Account type">
              <Select name="accountType" defaultValue="AUTO_SHOP">
                <option value="AUTO_SHOP">Auto shop</option>
                <option value="BUSINESS">Business</option>
                <option value="PERSONAL">Personal</option>
              </Select>
            </Field>
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="invoices" className="mt-0.5 h-4 w-4" />
              <span>
                <span className="block font-medium text-zinc-800">
                  Include invoices and customers
                </span>
                <span className="block text-xs text-zinc-500">
                  This only affects personal accounts; shop and business
                  accounts get everything.
                </span>
              </span>
            </label>
            <Field label="Owner username">
              <Input
                name="username"
                required
                autoCapitalize="none"
                placeholder="e.g. drivenation"
              />
            </Field>
            <Field label="Owner password">
              <Input
                name="password"
                type="text"
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
            </Field>
            <p className="text-xs text-zinc-500">
              Creates the account plus its first owner login. Share these
              credentials with the owner; they can change the password and add
              staff from their Logins page.
            </p>
            <Button type="submit">Create account</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title={`Accounts (${orgs.length})`} />
          {orgs.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">No accounts yet.</div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {orgs.map((org) => {
                const suspended = org.status === "SUSPENDED";
                return (
                  <div key={org.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-zinc-900">
                          {org.name}
                          <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                            {accountTypeLabel(org.accountType)}
                          </span>
                          {suspended && (
                            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                              On hold
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {org._count.users} logins · {org._count.customers}{" "}
                          customers · {org._count.repairOrders} tickets
                        </div>
                        <div className="text-xs text-zinc-400">
                          {describeBilling(org)}
                        </div>
                      </div>
                      <form action={setBusinessStatus}>
                        <input type="hidden" name="orgId" value={org.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={suspended ? "ACTIVE" : "SUSPENDED"}
                        />
                        <button
                          type="submit"
                          className={
                            "inline-flex items-center justify-center rounded-md font-medium h-8 px-3 text-sm " +
                            (suspended
                              ? "bg-zinc-900 text-white hover:bg-zinc-800"
                              : "bg-white text-amber-700 border border-amber-300 hover:bg-amber-50")
                          }
                        >
                          {suspended ? "Reactivate" : "Put on hold"}
                        </button>
                      </form>
                    </div>

                    <form
                      action={renameBusiness}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="orgId" value={org.id} />
                      <input
                        name="name"
                        defaultValue={org.name}
                        className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                        aria-label="Business name"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-md font-medium h-8 px-3 text-sm bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50"
                      >
                        Rename
                      </button>
                    </form>

                    <form
                      action={extendTrial}
                      className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2"
                    >
                      <input type="hidden" name="orgId" value={org.id} />
                      <span className="text-xs font-medium text-amber-800">
                        Extend free trial
                      </span>
                      <input
                        name="days"
                        type="number"
                        min={1}
                        defaultValue={60}
                        aria-label="Trial days"
                        className="w-16 rounded-md border border-amber-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="text-xs text-amber-800">days from</span>
                      <select
                        name="from"
                        defaultValue="signup"
                        aria-label="Extend trial from"
                        className="rounded-md border border-amber-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="signup">signup date</option>
                        <option value="today">today</option>
                      </select>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-md font-medium h-8 px-3 text-sm bg-amber-500 text-zinc-950 hover:bg-amber-400"
                      >
                        Apply
                      </button>
                    </form>

                    <div className="rounded-md border border-zinc-200 p-2 space-y-2">
                      <div className="text-xs font-medium text-zinc-600">
                        Logins ({org.users.length}) — reset a password
                      </div>
                      {org.users.map((u) => (
                        <form
                          key={u.id}
                          action={adminResetUserPassword}
                          className="flex items-center gap-2"
                          data-testid={`admin-reset-form-${u.username}`}
                        >
                          <input type="hidden" name="userId" value={u.id} />
                          <span
                            className="w-32 shrink-0 truncate text-xs text-zinc-700"
                            title={u.username}
                          >
                            {u.username}
                            <span className="text-zinc-400">
                              {" "}
                              · {roleLabel(u.role)}
                            </span>
                          </span>
                          <input
                            name="password"
                            type="text"
                            required
                            minLength={6}
                            placeholder="new password"
                            aria-label={`New password for ${u.username}`}
                            className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
                            data-testid={`admin-reset-input-${u.username}`}
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-md font-medium h-8 px-3 text-sm bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50"
                            data-testid={`admin-reset-submit-${u.username}`}
                          >
                            Set
                          </button>
                        </form>
                      ))}
                      <p className="text-[11px] text-zinc-400">
                        Sets the password instantly (no email). Share it with the
                        owner; they can change it later from their Logins page.
                      </p>
                    </div>

                    <DeleteBusiness orgId={org.id} name={org.name} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
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
