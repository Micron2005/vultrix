import Link from "next/link";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { fullName, vehicleLabel } from "@/lib/utils";
import { getSetting } from "@/lib/shop";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ months?: string }>;

// Customers whose most recent RO opened more than `months` months ago (or
// who have no RO at all, if they're in the system but never returned).
// "Win-back" list — people we've lost to attrition who would come back
// with a nudge.

const DEFAULT_MONTHS = 6;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const orgId = await requireOrgId();
  const sp = await searchParams;
  const months = Math.max(1, Math.min(24, Number(sp.months) || DEFAULT_MONTHS));

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  cutoff.setHours(0, 0, 0, 0);

  const [customers, shopName, shopPhone] = await Promise.all([
    db.customer.findMany({
      where: { orgId },
      include: {
        vehicles: { orderBy: { updatedAt: "desc" } },
        repairOrders: {
          orderBy: { openedAt: "desc" },
          take: 1,
          include: { vehicle: true },
        },
      },
    }),
    getSetting(orgId, "shopName"),
    getSetting(orgId, "shopPhone"),
  ]);

  type Row = {
    customer: (typeof customers)[number];
    lastVisit: Date | null;
    daysSince: number | null;
    lastVehicle: (typeof customers)[number]["vehicles"][number] | null;
  };

  const rows: Row[] = customers
    .filter((c) => c.phone || c.email)
    .map((c) => {
      const lastRo = c.repairOrders[0] ?? null;
      const lastVisit = lastRo?.openedAt ?? null;
      const daysSince = lastVisit
        ? Math.floor((Date.now() - lastVisit.getTime()) / MS_PER_DAY)
        : null;
      const lastVehicle = lastRo?.vehicle ?? c.vehicles[0] ?? null;
      return { customer: c, lastVisit, daysSince, lastVehicle };
    })
    .filter((r) => {
      // Include customers with no RO only if they've been in the system for
      // more than the cutoff window — otherwise we're pinging brand-new
      // customers who haven't had time to come back yet.
      if (!r.lastVisit) {
        return r.customer.createdAt < cutoff;
      }
      return r.lastVisit < cutoff;
    })
    .sort((a, b) => {
      // Never-visited customers bubble to the top (longest "dormant").
      const aT = a.lastVisit ? a.lastVisit.getTime() : 0;
      const bT = b.lastVisit ? b.lastVisit.getTime() : 0;
      return aT - bT;
    });

  const displayShop = shopName || "QNA / Noor Auto Repair";

  return (
    <>
      <PageHeader
        title="Service reminders"
        description={`Customers who haven't been in the shop in ${months}+ months. Text or email each one to invite them back for service.`}
      />

      <Card className="p-4 mb-4">
        <form className="flex flex-wrap items-end gap-3 text-sm">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-700 mb-1">
              Dormant for at least
            </span>
            <select
              name="months"
              defaultValue={String(months)}
              className="block rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {[3, 6, 9, 12, 18, 24].map((m) => (
                <option key={m} value={m}>
                  {m} months
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-zinc-900 text-white h-9 px-3 text-sm font-medium hover:bg-zinc-800"
          >
            Apply
          </button>
          <div className="ml-auto text-xs text-zinc-500">
            {rows.length} customer{rows.length === 1 ? "" : "s"} due a nudge
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No dormant customers."
          description={`Everyone with a contact on file has been in within the last ${months} months.`}
        />
      ) : (
        <Card>
          <CardHeader title="Win-back candidates">
            <span className="text-xs text-zinc-500 font-normal">
              Sorted longest-dormant first. Opens your phone/mail app — you hit Send.
            </span>
          </CardHeader>
          <ul className="divide-y divide-zinc-200">
            {rows.map((r) => {
              const name = fullName(r.customer);
              const firstName = (r.customer.firstName || name).split(" ")[0];
              const vehiclePart = r.lastVehicle
                ? ` your ${vehicleLabel(r.lastVehicle)}`
                : " your vehicle";
              const dormantPart =
                r.daysSince != null
                  ? `It's been about ${Math.round(r.daysSince / 30)} month${
                      Math.round(r.daysSince / 30) === 1 ? "" : "s"
                    } since your last visit.`
                  : "We'd love to see you again.";
              const callPart = shopPhone ? ` Give us a call at ${shopPhone}` : " Reply to book an appointment";

              const smsBody =
                `Hi ${firstName}, it's ${displayShop}. ${dormantPart}` +
                ` If${vehiclePart} is due for service (oil change, brakes, tires),${callPart} and we'll get you in. Thanks!`;

              const emailSubject = `${displayShop} — time for your next service?`;
              const emailBody =
                `Hi ${firstName},\n\n` +
                `${dormantPart}\n\n` +
                `If${vehiclePart} is due for service — oil change, brakes, tires, or anything else — we'd love to take care of it.${shopPhone ? `\n\nCall us at ${shopPhone} to book an appointment.` : "\n\nReply to this email to book an appointment."}\n\n` +
                `Thanks,\n${displayShop}`;

              const smsHref = r.customer.phone
                ? `sms:${r.customer.phone.replace(/[^+\d]/g, "")}?body=${encodeURIComponent(smsBody)}`
                : null;
              const mailHref = r.customer.email
                ? `mailto:${encodeURIComponent(r.customer.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
                : null;

              return (
                <li key={r.customer.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/customers/${r.customer.id}`}
                          className="text-sm font-medium text-zinc-900 hover:underline"
                        >
                          {name}
                        </Link>
                        {r.customer.type === "BUSINESS" && (
                          <span className="text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 bg-zinc-100 text-zinc-700">
                            Business
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500 truncate">
                        {r.lastVehicle ? vehicleLabel(r.lastVehicle) : "No vehicle on file"}
                        {r.customer.phone && ` · ${r.customer.phone}`}
                        {r.customer.email && ` · ${r.customer.email}`}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-400">
                        {r.lastVisit
                          ? `Last visit ${Math.round((r.daysSince ?? 0) / 30)} month${Math.round((r.daysSince ?? 0) / 30) === 1 ? "" : "s"} ago`
                          : "Never visited"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {smsHref ? (
                        <a
                          href={smsHref}
                          className="inline-flex items-center h-8 px-3 rounded-md text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800"
                        >
                          Text
                        </a>
                      ) : (
                        <span className="inline-flex items-center h-8 px-3 rounded-md text-xs text-zinc-400">
                          No phone
                        </span>
                      )}
                      {mailHref ? (
                        <a
                          href={mailHref}
                          className="inline-flex items-center h-8 px-3 rounded-md text-sm font-medium border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                        >
                          Email
                        </a>
                      ) : (
                        <span className="inline-flex items-center h-8 px-3 rounded-md text-xs text-zinc-400">
                          No email
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
