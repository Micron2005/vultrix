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
import { getAllSettings, setSetting } from "@/lib/shop";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import {
  createShopFee,
  deleteShopFee,
  updateShopFee,
} from "./shop-fees-actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  const orgId = await requireOrgId();
  const sp = (await searchParams) ?? {};
  const settings = await getAllSettings(orgId);
  const shopFees = await db.shopFee.findMany({
    where: { orgId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

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
      <PageHeader title="Settings" description="Shop-wide configuration" />
      <Card className="max-w-2xl">
        <CardHeader title="Shop info" />
        <form action={save} className="p-6 space-y-4">
          <Field label="Shop name">
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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Default labor rate ($/hr)">
              <Input
                name="defaultLaborRate"
                defaultValue={settings.defaultLaborRate}
                inputMode="decimal"
              />
            </Field>
            <Field label="Default tax rate (%)">
              <Input
                name="defaultTaxRate"
                defaultValue={settings.defaultTaxRate}
                inputMode="decimal"
              />
            </Field>
          </div>
          <Button type="submit">Save settings</Button>
        </form>
      </Card>

      <div id="shop-fees" className="h-4" />
      <Card className="max-w-4xl mt-6">
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
                    <Button type="submit" variant="secondary" className="h-9">
                      Save
                    </Button>
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
      </Card>
    </>
  );
}
