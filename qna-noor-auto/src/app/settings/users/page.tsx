import { redirect } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { db } from "@/lib/db";
import { getCurrentUser, canManageUsers } from "@/lib/session";

export const dynamic = "force-dynamic";

import {
  createUser,
  deleteUser,
  resetPassword,
  setUserActive,
} from "./actions";

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  if (!canManageUsers(me.role) || !me.orgId) redirect("/settings");

  const users = await db.user.findMany({
    where: { orgId: me.orgId },
    orderBy: [{ role: "asc" }, { username: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Logins"
        description={`Manage who can sign in to ${me.orgName ?? "your business"}.`}
      />

      {sp.error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.saved && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Saved.
        </div>
      )}
      {sp.deleted && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Login removed.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Add a login" />
          <form action={createUser} className="p-4 space-y-3">
            <Field label="Username">
              <Input
                name="username"
                required
                autoCapitalize="none"
                placeholder="e.g. frontdesk"
              />
            </Field>
            <Field label="Temporary password">
              <Input
                name="password"
                type="text"
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
            </Field>
            <Field label="Role">
              <Select name="role" defaultValue="STAFF">
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Owner</option>
              </Select>
            </Field>
            <Button type="submit">Create login</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title={`Team (${users.length})`} />
          <div className="divide-y divide-zinc-100">
            {users.map((u) => (
              <div key={u.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-900">
                      {u.username}
                      {u.id === me.id && (
                        <span className="ml-2 text-xs text-zinc-400">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                      {!u.isActive && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                          On hold
                        </span>
                      )}
                    </div>
                  </div>
                  {u.id !== me.id && (
                    <div className="flex items-center gap-2">
                      <form action={setUserActive}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={u.isActive ? "0" : "1"}
                        />
                        <Button type="submit" variant="secondary" size="sm">
                          {u.isActive ? "Suspend" : "Reactivate"}
                        </Button>
                      </form>
                      <form action={deleteUser}>
                        <input type="hidden" name="userId" value={u.id} />
                        <Button type="submit" variant="danger" size="sm">
                          Delete
                        </Button>
                      </form>
                    </div>
                  )}
                </div>
                <form
                  action={resetPassword}
                  className="flex items-end gap-2"
                >
                  <input type="hidden" name="userId" value={u.id} />
                  <Field label="Reset password" className="flex-1">
                    <Input
                      name="password"
                      type="text"
                      minLength={6}
                      placeholder="New password"
                    />
                  </Field>
                  <Button type="submit" variant="secondary" size="sm">
                    Set
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
