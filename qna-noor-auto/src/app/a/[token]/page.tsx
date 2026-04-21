import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAllSettings } from "@/lib/shop";
import { formatDateTime, fullName, vehicleLabel } from "@/lib/utils";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

export default async function PublicReminderPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;

  const appt = await db.appointment.findUnique({
    where: { shareToken: token },
    include: {
      customer: true,
      vehicle: true,
    },
  });
  if (!appt) notFound();

  const shop = await getAllSettings();

  const startsAt = new Date(appt.startsAt);
  const endsAt = new Date(startsAt);
  endsAt.setMinutes(endsAt.getMinutes() + appt.durationMinutes);

  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-zinc-100 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-xl px-4 print:px-0 print:max-w-full">
        <div className="rounded-lg bg-white shadow-sm overflow-hidden print:shadow-none print:rounded-none">
          <header className="px-8 py-6 border-b border-zinc-200 text-center">
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Appointment reminder
            </div>
            <div className="mt-2 text-xl font-semibold text-zinc-900">
              {shop.shopName}
            </div>
            {shop.shopAddress && (
              <div className="mt-1 text-xs text-zinc-600 whitespace-pre-line">
                {shop.shopAddress}
              </div>
            )}
            {(shop.shopPhone || shop.shopEmail) && (
              <div className="mt-0.5 text-xs text-zinc-600">
                {[shop.shopPhone, shop.shopEmail].filter(Boolean).join(" · ")}
              </div>
            )}
          </header>

          <div className="px-8 py-6 text-center border-b border-zinc-200">
            <div className="text-sm text-zinc-600">
              {fullName(appt.customer)}, we&apos;ll see you:
            </div>
            <div className="mt-3 text-2xl font-semibold text-zinc-900">
              {dateFmt.format(startsAt)}
            </div>
            <div className="mt-1 text-lg text-zinc-700">
              {timeFmt.format(startsAt)} – {timeFmt.format(endsAt)}
            </div>
          </div>

          <dl className="px-8 py-6 divide-y divide-zinc-200 text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-zinc-500">Service</dt>
              <dd className="text-zinc-900 text-right max-w-[70%]">
                {appt.reason}
              </dd>
            </div>
            {appt.vehicle && (
              <div className="flex justify-between py-2">
                <dt className="text-zinc-500">Vehicle</dt>
                <dd className="text-zinc-900 text-right max-w-[70%]">
                  {vehicleLabel(appt.vehicle)}
                  {appt.vehicle.licensePlate && (
                    <span className="text-zinc-500">
                      {" "}
                      · {appt.vehicle.licensePlate}
                    </span>
                  )}
                </dd>
              </div>
            )}
            <div className="flex justify-between py-2">
              <dt className="text-zinc-500">Length</dt>
              <dd className="text-zinc-900">
                ~{appt.durationMinutes} minutes
              </dd>
            </div>
          </dl>

          <footer className="px-8 py-4 bg-zinc-50 text-center text-xs text-zinc-500 print:bg-white">
            Please arrive a few minutes early. Need to reschedule? Call us at{" "}
            {shop.shopPhone || "the shop"}.
          </footer>
        </div>

        <div className="mt-4 text-center text-xs text-zinc-500 print:hidden">
          <PrintButton />
          <div className="mt-2 text-[11px] text-zinc-500">
            Saved {formatDateTime(appt.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}
