import Link from "next/link";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Select,
} from "@/components/ui";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";
import { updateLeadStatus } from "./actions";
import { DeleteLead } from "./DeleteLead";

export const dynamic = "force-dynamic";

const LEAD_STATUSES = ["new", "contacted", "won", "lost"] as const;

const NOTICES: Record<string, string> = {
  updated: "Lead updated.",
  deleted: "Lead deleted.",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  won: "Won",
  lost: "Lost",
};

const STATUS_STYLE: Record<string, string> = {
  new: "bg-amber-100 text-amber-800",
  contacted: "bg-blue-100 text-blue-800",
  won: "bg-green-100 text-green-800",
  lost: "bg-zinc-100 text-zinc-500",
};

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string; status?: string }>;
}) {
  await requireSuperadmin();
  const sp = (await searchParams) ?? {};
  const filter =
    sp.status && (LEAD_STATUSES as readonly string[]).includes(sp.status)
      ? sp.status
      : "all";

  const allLeads = await db.marketingLead.findMany({
    orderBy: { createdAt: "desc" },
  });
  const leads =
    filter === "all"
      ? allLeads
      : allLeads.filter((l) => l.status === filter);

  const total = allLeads.length;
  const countBy = (s: string) => allLeads.filter((l) => l.status === s).length;

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "all", label: "All", count: total },
    { key: "new", label: "New", count: countBy("new") },
    { key: "contacted", label: "Contacted", count: countBy("contacted") },
    { key: "won", label: "Won", count: countBy("won") },
    { key: "lost", label: "Lost", count: countBy("lost") },
  ];

  return (
    <div data-testid="leads-dashboard">
      <PageHeader
        title="Leads"
        description="Contact requests from the Vultrix landing page. Follow up fast — fresh leads convert best."
      />

      {sp.error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.saved && NOTICES[sp.saved] && (
        <div
          className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700"
          data-testid="leads-notice"
        >
          {NOTICES[sp.saved]}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <Link
              key={t.key}
              href={t.key === "all" ? "/admin/leads" : `/admin/leads?status=${t.key}`}
              className={
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                (active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50")
              }
            >
              {t.label}
              <span
                className={
                  "rounded-full px-1.5 text-xs " +
                  (active ? "bg-white/20" : "bg-zinc-100 text-zinc-600")
                }
              >
                {t.count}
              </span>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader title={`${filter === "all" ? "All leads" : STATUS_LABEL[filter] + " leads"} (${leads.length})`} />
        {leads.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No leads here yet"
              description={
                total === 0
                  ? "When someone submits the contact form on your landing page, they'll show up here."
                  : "No leads match this filter."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {leads.map((lead) => (
              <li key={lead.id} className="p-4" data-testid={`lead-row-${lead.id}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900">
                        {lead.name}
                      </span>
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                          (STATUS_STYLE[lead.status] ?? "bg-zinc-100 text-zinc-600")
                        }
                        data-testid={`lead-status-${lead.id}`}
                      >
                        {STATUS_LABEL[lead.status] ?? lead.status}
                      </span>
                      {lead.shop && (
                        <span className="text-xs text-zinc-500">· {lead.shop}</span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <a
                        href={`mailto:${lead.email}`}
                        className="font-medium text-zinc-700 hover:text-zinc-900 hover:underline"
                        data-testid={`lead-email-${lead.id}`}
                      >
                        {lead.email}
                      </a>
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-zinc-600 hover:text-zinc-900 hover:underline"
                        >
                          {lead.phone}
                        </a>
                      )}
                    </div>

                    {lead.message && (
                      <p className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
                        {lead.message}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
                      <span>{fmtDate(lead.createdAt)}</span>
                      <span>· via {lead.source}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <form
                      action={updateLeadStatus}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="id" value={lead.id} />
                      <Select
                        name="status"
                        defaultValue={lead.status}
                        aria-label="Lead status"
                        className="h-9 w-36"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                      >
                        Update
                      </Button>
                    </form>
                  </div>
                </div>

                <div className="mt-2 flex justify-end">
                  <DeleteLead id={lead.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
