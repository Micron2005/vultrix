import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
} from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import { getAllSettings, setSetting } from "@/lib/shop";
import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser, requireOrgId } from "@/lib/session";
import { isMarketingOwnerOrg } from "@/lib/marketing";
import { intakeUrl } from "@/lib/intakeTokens";
import { enabledFeatureSet } from "@/lib/features";
import {
  createShopFee,
  deleteShopFee,
  updateShopFee,
} from "./shop-fees-actions";

export const dynamic = "force-dynamic";

async function resolveOrigin(): Promise<string> {
  const hdrs = await headers();
  const forwardedHost = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const forwardedProto =
    hdrs.get("x-forwarded-proto") ??
    (forwardedHost.startsWith("localhost") ? "http" : "https");
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    saved?: string;
    deleted?: string;
    error?: string;
  }>;
}) {
  const orgId = await requireOrgId();
  const user = await getCurrentUser();
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) redirect("/");
  const accountType = org.accountType ?? "AUTO_SHOP";
  const featureSet = enabledFeatureSet(org);
  const showAutoSettings = featureSet.has("repair_orders");
  const showTaxRate = featureSet.has("invoices");
  const showIntakeQr = Boolean(user && showAutoSettings);
  const showFlyer = await isMarketingOwnerOrg(orgId);
  const sp = (await searchParams) ?? {};
  const settings = await getAllSettings(orgId);
  const origin = await resolveOrigin();
  const intakeLink = intakeUrl(origin, orgId);
  const shopFees = showAutoSettings
    ? await db.shopFee.findMany({
        where: { orgId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      })
    : [];

  async function save(fd: FormData) {
    "use server";
    const saveOrgId = await requireOrgId();
    const keys = [
      "shopName",
      "shopAddress",
      "shopPhone",
      "shopEmail",
      "defaultLaborRate",
      "defaultTaxRate",
    ];
    for (const k of keys) {
      const v = fd.get(k);
      if (typeof v === "string") await setSetting(saveOrgId, k, v);
    }
    revalidatePath("/settings");
    revalidatePath("/");
    redirect("/settings");
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          accountType === "AUTO_SHOP"
            ? "Shop-wide configuration"
            : "Account configuration"
        }
      />
      <Card className="max-w-2xl">
        <CardHeader
          title={
            accountType === "AUTO_SHOP"
              ? "Shop info"
              : accountType === "BUSINESS"
                ? "Business information"
                : "Personal information"
          }
        />
        <form action={save} className="p-6 space-y-4">
          <Field
            label={
              accountType === "AUTO_SHOP"
                ? "Shop name"
                : accountType === "BUSINESS"
                  ? "Business name"
                  : "Name"
            }
          >
            <Input name="shopName" defaultValue={settings.shopName} />
          </Field>
          <Field label="Address">
            <Input name="shopAddress" defaultValue={settings.shopAddress} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Phone">
              <Input name="shopPhone" defaultValue={settings.shopPhone} />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                name="shopEmail"
                defaultValue={settings.shopEmail}
              />
            </Field>
          </div>
          {(showAutoSettings || showTaxRate) && (
            <div
              className={
                showAutoSettings && showTaxRate
                  ? "grid grid-cols-2 gap-4"
                  : "grid grid-cols-1 gap-4"
              }
            >
              {showAutoSettings && (
                <Field label="Default labor rate ($/hr)">
                  <Input
                    name="defaultLaborRate"
                    defaultValue={settings.defaultLaborRate}
                    inputMode="decimal"
                  />
                </Field>
              )}
              {showTaxRate && (
                <Field label="Default tax rate (%)">
                  <Input
                    name="defaultTaxRate"
                    defaultValue={settings.defaultTaxRate}
                    inputMode="decimal"
                  />
                </Field>
              )}
            </div>
          )}
          <SaveButton>Save settings</SaveButton>
        </form>
      </Card>

      {showAutoSettings && <div id="shop-fees" className="h-4" />}
      {showAutoSettings && <Card className="max-w-4xl mt-6">
        <CardHeader title="Shop fees">
          <span className="text-xs text-zinc-500 font-normal">
            Percentage-based fees (Shop Supplies, Hazardous Materials, etc.) that auto-apply to every repair order. You can exclude specific fees per RO from the RO detail page.
          </span>
        </CardHeader>
        {sp.saved && (
          <div className="mx-6 mt-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
            Shop fee saved.
          </div>
        )}
        {sp.deleted && (
          <div className="mx-6 mt-4 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
            Shop fee deleted.
          </div>
        )}
        {sp.error === "fee_name_required" && (
          <div className="mx-6 mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
            Name is required.
          </div>
        )}
        <div className="p-6 space-y-6">
          {shopFees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shop fees yet. Add one below.
            </p>
          ) : (
            <div className="space-y-3">
              {shopFees.map((f) => (
                <div
                  key={f.id}
                  className="rounded-md border bg-neutral-50 p-3 space-y-2"
                >
                <form
                  action={updateShopFee.bind(null, f.id)}
                  className="grid grid-cols-12 gap-2 items-end"
                >
                  <div className="col-span-3">
                    <Field label="Name">
                      <Input name="name" defaultValue={f.name} required />
                    </Field>
                  </div>
                  <div className="col-span-3">
                    <Field label="Description (shown on invoice)">
                      <Input name="description" defaultValue={f.description ?? ""} />
                    </Field>
                  </div>
                  <div className="col-span-1">
                    <Field label="Parts %">
                      <Input
                        name="partsPercent"
                        defaultValue={f.partsPercent}
                        inputMode="decimal"
                      />
                    </Field>
                  </div>
                  <div className="col-span-1">
                    <Field label="Labor %">
                      <Input
                        name="laborPercent"
                        defaultValue={f.laborPercent}
                        inputMode="decimal"
                      />
                    </Field>
                  </div>
                  <div className="col-span-1">
                    <Field label="Max $">
                      <Input
                        name="maxCap"
                        defaultValue={f.maxCap ?? ""}
                        placeholder="no cap"
                        inputMode="decimal"
                      />
                    </Field>
                  </div>
                  <div className="col-span-1 flex flex-col items-start gap-1">
                    <label className="text-xs text-muted-foreground">Taxable</label>
                    <input
                      type="checkbox"
                      name="taxable"
                      defaultChecked={f.taxable}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="col-span-1 flex flex-col items-start gap-1">
                    <label className="text-xs text-muted-foreground">Active</label>
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={f.active}
                      className="h-4 w-4"
                    />
                  </div>
                  <div className="col-span-1 flex gap-1">
                    <SaveButton>Save</SaveButton>
                  </div>
                </form>
                <form
                  action={deleteShopFee.bind(null, f.id)}
                  className="inline"
                >
                  <button
                    type="submit"
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete fee
                  </button>
                </form>
                </div>
              ))}
            </div>
          )}

          <form
            action={createShopFee}
            className="grid grid-cols-12 gap-2 items-end rounded-md border border-dashed border-neutral-300 p-3"
          >
            <div className="col-span-12 -mb-1 text-sm font-medium">Add shop fee</div>
            <div className="col-span-3">
              <Field label="Name">
                <Input name="name" placeholder="Shop Supplies" required />
              </Field>
            </div>
            <div className="col-span-3">
              <Field label="Description">
                <Input name="description" placeholder="Shop Supplies" />
              </Field>
            </div>
            <div className="col-span-1">
              <Field label="Parts %">
                <Input name="partsPercent" defaultValue="0" inputMode="decimal" />
              </Field>
            </div>
            <div className="col-span-1">
              <Field label="Labor %">
                <Input name="laborPercent" defaultValue="0" inputMode="decimal" />
              </Field>
            </div>
            <div className="col-span-1">
              <Field label="Max $">
                <Input name="maxCap" placeholder="no cap" inputMode="decimal" />
              </Field>
            </div>
            <div className="col-span-1 flex flex-col items-start gap-1">
              <label className="text-xs text-muted-foreground">Taxable</label>
              <input type="checkbox" name="taxable" className="h-4 w-4" />
            </div>
            <div className="col-span-1 flex flex-col items-start gap-1">
              <label className="text-xs text-muted-foreground">Active</label>
              <input
                type="checkbox"
                name="active"
                defaultChecked
                className="h-4 w-4"
              />
            </div>
            <div className="col-span-1">
              <Button type="submit" className="h-9">
                Add
              </Button>
            </div>
          </form>
        </div>
      </Card>}

      {showIntakeQr && (
        <Card className="max-w-2xl">
          <CardHeader title="Shop intake QR" />
          <div className="space-y-3 p-4">
            <p className="text-sm text-zinc-600">
              Print a QR code and post it in your shop. Techs (or customers) scan
              it with a phone to start a new ticket — pick or add the customer,
              add the vehicle, and describe the work. No login needed.
            </p>
            {intakeLink ? (
              <>
                <div
                  className="break-all rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700"
                  data-testid="intake-url"
                >
                  {intakeLink}
                </div>
                <Link
                  href="/settings/intake-qr"
                  className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  data-testid="open-intake-qr"
                >
                  Open printable QR →
                </Link>
              </>
            ) : (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                To enable the public intake QR, set an{" "}
                <code className="font-mono">INTAKE_SIGNING_SECRET</code>{" "}
                environment variable (any long random string) in your Vercel
                project, then redeploy.
              </div>
            )}
          </div>
        </Card>
      )}

      {showFlyer && (
        <Card className="max-w-2xl">
          <CardHeader title="Marketing flyer" />
          <div className="space-y-3 p-4">
            <p className="text-sm text-zinc-600">
              A print-ready, one-page flyer for selling Vultrix to other shops —
              features, price, and a QR code that takes them straight to a free
              trial, with your contact info on it. Open it, then print it or save
              it as a PDF to text or email.
            </p>
            <Link
              href="/flyer"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              data-testid="open-flyer"
            >
              Open printable flyer →
            </Link>
          </div>
        </Card>
      )}
    </>
  );
}
