import { db } from "@/lib/db";
import { verifyOrgIntake } from "@/lib/intakeTokens";
import { fullName, vehicleLabel } from "@/lib/utils";
import {
  createIntakeCustomer,
  createIntakeVehicle,
  createIntakeRO,
} from "../actions";

export const dynamic = "force-dynamic";

const fieldCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10";
const labelCls = "mb-1 block text-sm font-medium text-zinc-700";
const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-zinc-800 active:bg-zinc-950";

type SP = {
  k?: string;
  mode?: string;
  q?: string;
  customerId?: string;
  vehicleId?: string;
  done?: string;
  error?: string;
};

function hrefFor(
  orgId: string,
  k: string,
  extra: Record<string, string | undefined>,
): string {
  const usp = new URLSearchParams({ k });
  for (const [key, val] of Object.entries(extra)) {
    if (val) usp.set(key, val);
  }
  return `/i/${orgId}?${usp.toString()}`;
}

function Shell({
  shopName,
  title,
  subtitle,
  backHref,
  children,
}: {
  shopName: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            {shopName}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
        {backHref ? (
          <a
            href={backHref}
            className="mb-3 inline-block text-sm text-zinc-500 hover:text-zinc-800"
            data-testid="intake-back"
          >
            ← Back
          </a>
        ) : null}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

function InvalidShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">Link not valid</h1>
        <p className="mt-2 text-sm text-zinc-500">
          This intake link is invalid or has expired. Please scan the QR code
          posted in the shop again, or ask the front desk for a fresh link.
        </p>
      </div>
    </div>
  );
}

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<SP>;
}) {
  const { orgId } = await params;
  const sp = await searchParams;
  const k = sp.k ?? "";

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, status: true },
  });

  if (!org || org.status !== "ACTIVE" || !verifyOrgIntake(orgId, k)) {
    return <InvalidShell />;
  }
  const shopName = org.name;

  // ---- Step: done -------------------------------------------------------
  if (sp.done) {
    return (
      <Shell shopName={shopName} title="Ticket created">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
            ✓
          </div>
          <p className="mt-4 text-zinc-700" data-testid="intake-done">
            Thanks! Service ticket{" "}
            <span className="font-semibold">#{sp.done}</span> was created. A
            service writer will review and price it.
          </p>
          <a
            href={hrefFor(orgId, k, {})}
            className={`mt-6 ${primaryBtn}`}
            data-testid="intake-another"
          >
            Start another ticket
          </a>
        </div>
      </Shell>
    );
  }

  // ---- Step: describe the work (customer + vehicle chosen) --------------
  if (sp.customerId && sp.vehicleId) {
    const customer = await db.customer.findFirst({
      where: { id: sp.customerId, orgId },
      select: { firstName: true, lastName: true, companyName: true },
    });
    const vehicle = await db.vehicle.findFirst({
      where: { id: sp.vehicleId, orgId, customerId: sp.customerId },
      select: { year: true, make: true, model: true, trim: true },
    });
    if (!customer || !vehicle) {
      return (
        <Shell shopName={shopName} title="Let's start over">
          <a href={hrefFor(orgId, k, {})} className={primaryBtn}>
            Start over
          </a>
        </Shell>
      );
    }
    return (
      <Shell
        shopName={shopName}
        title="What's the work?"
        subtitle="Describe what needs to be done or what's wrong."
        backHref={hrefFor(orgId, k, { customerId: sp.customerId })}
      >
        <div className="mb-4 rounded-lg bg-zinc-50 p-3 text-sm">
          <div className="font-medium text-zinc-900">{fullName(customer)}</div>
          <div className="text-zinc-500">{vehicleLabel(vehicle)}</div>
        </div>
        <form action={createIntakeRO} className="space-y-4">
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="k" value={k} />
          <input type="hidden" name="customerId" value={sp.customerId} />
          <input type="hidden" name="vehicleId" value={sp.vehicleId} />
          <div>
            <label className={labelCls} htmlFor="complaint">
              Work needed / problem
            </label>
            <textarea
              id="complaint"
              name="complaint"
              required
              rows={5}
              placeholder="e.g. Grinding noise from front brakes, please inspect and replace as needed."
              className={fieldCls}
              data-testid="intake-complaint"
            />
            {sp.error === "required" ? (
              <p className="mt-1 text-sm text-red-600">
                Please describe the work needed.
              </p>
            ) : null}
          </div>
          <div>
            <label className={labelCls} htmlFor="mileage">
              Current mileage (optional)
            </label>
            <input
              id="mileage"
              name="mileage"
              inputMode="numeric"
              placeholder="e.g. 84,500"
              className={fieldCls}
              data-testid="intake-mileage"
            />
          </div>
          <button type="submit" className={primaryBtn} data-testid="intake-create-ticket">
            Create ticket
          </button>
        </form>
      </Shell>
    );
  }

  // ---- Step: vehicle (customer chosen) ----------------------------------
  if (sp.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: sp.customerId, orgId },
      select: { firstName: true, lastName: true, companyName: true },
    });
    if (!customer) {
      return (
        <Shell shopName={shopName} title="Let's start over">
          <a href={hrefFor(orgId, k, {})} className={primaryBtn}>
            Start over
          </a>
        </Shell>
      );
    }
    const vehicles = await db.vehicle.findMany({
      where: { orgId, customerId: sp.customerId },
      orderBy: [{ year: "desc" }, { make: "asc" }],
      select: {
        id: true,
        year: true,
        make: true,
        model: true,
        trim: true,
        licensePlate: true,
      },
    });
    return (
      <Shell
        shopName={shopName}
        title="Vehicle"
        subtitle={`for ${fullName(customer)}`}
        backHref={hrefFor(orgId, k, { mode: "existing" })}
      >
        {vehicles.length > 0 ? (
          <div className="mb-5 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Pick a vehicle
            </div>
            {vehicles.map((v) => (
              <form key={v.id} action={createIntakeVehicle}>
                <input type="hidden" name="orgId" value={orgId} />
                <input type="hidden" name="k" value={k} />
                <input type="hidden" name="customerId" value={sp.customerId} />
                <input type="hidden" name="vehicleId" value={v.id} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-left hover:border-zinc-900 hover:bg-zinc-50"
                  data-testid="intake-pick-vehicle"
                >
                  <span className="font-medium text-zinc-900">
                    {vehicleLabel(v)}
                  </span>
                  {v.licensePlate ? (
                    <span className="text-xs text-zinc-500">
                      {v.licensePlate}
                    </span>
                  ) : null}
                </button>
              </form>
            ))}
          </div>
        ) : null}

        <details open={vehicles.length === 0} className="group">
          <summary className="cursor-pointer list-none rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-600 hover:border-zinc-900 hover:text-zinc-900">
            + Add a vehicle
          </summary>
          <form action={createIntakeVehicle} className="mt-4 space-y-3">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="k" value={k} />
            <input type="hidden" name="customerId" value={sp.customerId} />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Year</label>
                <input name="year" inputMode="numeric" className={fieldCls} data-testid="intake-veh-year" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Make *</label>
                <input name="make" required className={fieldCls} data-testid="intake-veh-make" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Model *</label>
              <input name="model" required className={fieldCls} data-testid="intake-veh-model" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Trim</label>
                <input name="trim" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Engine</label>
                <input name="engine" className={fieldCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>License plate</label>
                <input name="licensePlate" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Plate state</label>
                <input name="licenseState" maxLength={2} className={fieldCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>VIN</label>
                <input name="vin" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls}>Mileage</label>
                <input name="mileage" inputMode="numeric" className={fieldCls} />
              </div>
            </div>
            {sp.error === "vehicle" ? (
              <p className="text-sm text-red-600">
                Make and model are required to add a vehicle.
              </p>
            ) : null}
            <button type="submit" className={primaryBtn} data-testid="intake-add-vehicle">
              Add vehicle &amp; continue
            </button>
          </form>
        </details>
      </Shell>
    );
  }

  // ---- Step: existing customer search -----------------------------------
  if (sp.mode === "existing") {
    const q = (sp.q ?? "").trim();
    const results = q
      ? await db.customer.findMany({
          where: {
            orgId,
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          },
          take: 25,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            phone: true,
          },
        })
      : [];
    return (
      <Shell
        shopName={shopName}
        title="Find customer"
        subtitle="Search by name or phone."
        backHref={hrefFor(orgId, k, {})}
      >
        <form method="get" action={`/i/${orgId}`} className="flex gap-2">
          <input type="hidden" name="k" value={k} />
          <input type="hidden" name="mode" value="existing" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Name or phone…"
            className={fieldCls}
            data-testid="intake-search-input"
            autoFocus
          />
          <button type="submit" className="shrink-0 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800" data-testid="intake-search-btn">
            Search
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {q && results.length === 0 ? (
            <p className="text-sm text-zinc-500">No matches for “{q}”.</p>
          ) : null}
          {results.map((c) => (
            <a
              key={c.id}
              href={hrefFor(orgId, k, { customerId: c.id })}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:border-zinc-900 hover:bg-zinc-50"
              data-testid="intake-customer-result"
            >
              <span className="font-medium text-zinc-900">{fullName(c)}</span>
              {c.phone ? (
                <span className="text-xs text-zinc-500">{c.phone}</span>
              ) : null}
            </a>
          ))}
        </div>

        <div className="mt-5 border-t border-zinc-100 pt-4 text-center text-sm text-zinc-500">
          Can&apos;t find them?{" "}
          <a
            href={hrefFor(orgId, k, { mode: "new" })}
            className="font-medium text-zinc-900 underline"
            data-testid="intake-new-instead"
          >
            Add a new customer
          </a>
        </div>
      </Shell>
    );
  }

  // ---- Step: new customer -----------------------------------------------
  if (sp.mode === "new") {
    return (
      <Shell
        shopName={shopName}
        title="New customer"
        subtitle="Tell us a bit about you."
        backHref={hrefFor(orgId, k, {})}
      >
        <form action={createIntakeCustomer} className="space-y-3">
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="k" value={k} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First name *</label>
              <input name="firstName" required className={fieldCls} data-testid="intake-first" />
            </div>
            <div>
              <label className={labelCls}>Last name *</label>
              <input name="lastName" required className={fieldCls} data-testid="intake-last" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone *</label>
              <input name="phone" type="tel" required className={fieldCls} data-testid="intake-phone" />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input name="email" type="email" required className={fieldCls} data-testid="intake-email" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Street address *</label>
            <input name="street" required className={fieldCls} data-testid="intake-street" />
          </div>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-3">
              <label className={labelCls}>City *</label>
              <input name="city" required className={fieldCls} data-testid="intake-city" />
            </div>
            <div className="col-span-1">
              <label className={labelCls}>State *</label>
              <input name="state" required maxLength={2} className={fieldCls} data-testid="intake-state" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>ZIP *</label>
              <input name="zip" required inputMode="numeric" className={fieldCls} data-testid="intake-zip" />
            </div>
          </div>
          {sp.error === "required" ? (
            <p className="text-sm text-red-600">All fields are required.</p>
          ) : null}
          <button type="submit" className={primaryBtn} data-testid="intake-save-customer">
            Continue
          </button>
        </form>
      </Shell>
    );
  }

  // ---- Step: start (new vs existing) ------------------------------------
  return (
    <Shell
      shopName={shopName}
      title="New service ticket"
      subtitle="Let's get your vehicle checked in."
    >
      <div className="space-y-3">
        <a
          href={hrefFor(orgId, k, { mode: "new" })}
          className={primaryBtn}
          data-testid="intake-choice-new"
        >
          New customer
        </a>
        <a
          href={hrefFor(orgId, k, { mode: "existing" })}
          className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base font-semibold text-zinc-900 hover:bg-zinc-50"
          data-testid="intake-choice-existing"
        >
          Existing customer
        </a>
      </div>
    </Shell>
  );
}
