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

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getAllSettings();

  async function save(fd: FormData) {
    "use server";
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
      if (typeof v === "string") await setSetting(k, v);
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
    </>
  );
}
