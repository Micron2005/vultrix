import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
} from "@/components/ui";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { APP_NAME } from "@/lib/branding";
import { describeBilling } from "@/lib/billing";
import {
  createBusiness,
  extendTrial,
  renameBusiness,
  setBusinessStatus,
  adminResetUserPassword,
} from "./actions";
import { DeleteBusiness } from "./DeleteBusiness";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  created: "Business created.",
  suspended: "Business put on hold.",
  reactivated: "Business reactivated.",
  renamed: "Business renamed.",
  deleted: "Business deleted.",
  "trial-extended": "Free trial extended.",
  "password-reset": "Password updated. Share the new password with the owner.",
};

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
        select: { users: true, customers: true, repairOrders: true },
      },
      users: {
        orderBy: { createdAt: "asc" },
        select: { id: true, username: true, role: true, isActive: true },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Manage businesses"
        description={`Platform controls for ${APP_NAME}. Create a business, put one on hold, or delete it.`}
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

      <div className="grid gap-6 md:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader title="Add a business" />
          <form action={createBusiness} className="p-4 space-y-3">
            <Field label="Business name">
              <Input name="name" required placeholder="e.g. Drive Nation Auto" />
            </Field>
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
              Creates the business plus its first owner login. Share these
              credentials with the owner; they can change the password and add
              staff from their Logins page.
            </p>
            <Button type="submit">Create business</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title={`Businesses (${orgs.length})`} />
          {orgs.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">No businesses yet.</div>
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
                              · {u.role.toLowerCase()}
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
    </div>
  );
}
