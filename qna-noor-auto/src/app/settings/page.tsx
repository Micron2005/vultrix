import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { SaveButton } from "@/components/SaveButton";
import { isAiKeyEncryptionConfigured } from "@/lib/ai-key-crypto";
import { logActivity } from "@/lib/activity";
import { getAllSettings, setSetting } from "@/lib/shop";
import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/lib/db";
import {
  canManageUsers,
  getCurrentUser,
  requireOrgId,
} from "@/lib/session";
import {
  assertCanManageSettings,
  canViewFinancials,
  requireSettingsAccess,
} from "@/lib/permissions";
import { intakeUrl } from "@/lib/intakeTokens";
import { enabledFeatureSet } from "@/lib/features";
import { isValidTimeZone } from "@/lib/timezone";
import {
  createShopFee,
  deleteShopFee,
  updateShopFee,
} from "./shop-fees-actions";
import { saveAiAssistantSettings } from "./ai-assistant-actions";
import { VoicePicker } from "./VoicePicker";
import { TimezonePicker } from "./TimezonePicker";
import { ThemeToggle, type ThemeMode } from "@/components/ThemeToggle";
import { AppearanceEditor } from "./AppearanceEditor";
import { resolveAppearance } from "@/lib/appearance";
import { NavLayoutEditor } from "./NavLayoutEditor";
import {
  getEligibleNavItems,
  navItemLabel,
  resolveNavLayout,
} from "@/lib/navLayout";
import {
  clearAppearanceDefault,
  clearDashboardDefault,
  clearNavDefault,
  publishAppearanceDefault,
  publishDashboardDefault,
  publishNavDefault,
} from "./default-actions";

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
    assistant_saved?: string;
    assistant_error?: string;
  }>;
}) {
  const orgId = await requireOrgId();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireSettingsAccess();
  const themeCookie = (await cookies()).get("vx-theme")?.value;
  const theme: ThemeMode =
    themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) redirect("/");
  const accountType = org.accountType ?? "AUTO_SHOP";
  const isPersonal = accountType === "PERSONAL";
  const appearanceRecord = await db.user.findUnique({
    where: { id: user.id },
    select: {
      uiPalette: true,
      uiAccent: true,
      uiScale: true,
      uiRadius: true,
      uiFont: true,
      navLayout: true,
      dashLayout: true,
    },
  });
  const appearancePrefs = resolveAppearance(appearanceRecord, org.uiDefaults);
  const accountDefaultAppearance = resolveAppearance(null, org.uiDefaults);
  const canManageOrgSettings = Boolean(
    user && (user.role === "OWNER" || user.role === "ADMIN"),
  );
  const aiKeyConfigured = isAiKeyEncryptionConfigured();
  const featureSet = enabledFeatureSet(org);
  const eligibleNavItems = getEligibleNavItems({
    enabledFeatures: featureSet,
    accountType,
    canViewFinancials: Boolean(user && canViewFinancials(user.role)),
    canManageUsers: Boolean(user && canManageUsers(user.role)),
    aiAssistantEnabled: isPersonal && org.aiAssistantEnabled,
  }).map((item) => ({
    ...item,
    label: navItemLabel(item, {
      accountType,
      enabledFeatures: featureSet,
    }),
  }));
  const navOptions = {
    accountType,
    enabledFeatures: featureSet,
  };
  const navLayout = resolveNavLayout(
    appearanceRecord?.navLayout,
    org.navDefault,
    navOptions,
  );
  const accountDefaultNavLayout = resolveNavLayout(
    null,
    org.navDefault,
    navOptions,
  );
  const showAutoSettings = featureSet.has("repair_orders");
  const showTaxRate = featureSet.has("invoices");
  const showAppointmentReminders = featureSet.has("schedule");
  const showPastDueReminders = featureSet.has("invoices");
  const showServiceDueReminders = featureSet.has("vehicles");
  const showReminderSettings =
    showAppointmentReminders || showPastDueReminders || showServiceDueReminders;
  const showWeeklyReview =
    Boolean(user && canViewFinancials(user.role)) &&
    featureSet.has("financials");
  const showIntakeQr = Boolean(user && showAutoSettings);
  const sp = (await searchParams) ?? {};
  const settings = await getAllSettings(orgId);
  const owner = await db.user.findFirst({
    where: { orgId, role: "OWNER", isActive: true },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
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
    const saveUser = await requireSettingsAccess();
    assertCanManageSettings(saveUser.role);
    const saveOrgId = await requireOrgId();
    const submittedTimezone = String(fd.get("timezone") ?? "");
    const currentOrg = await db.organization.findUnique({
      where: { id: saveOrgId },
      select: { timezone: true },
    });
    const timezone = isValidTimeZone(submittedTimezone)
      ? submittedTimezone
      : currentOrg?.timezone ?? "America/New_York";
    await db.organization.update({
      where: { id: saveOrgId },
      data: { timezone },
    });
    const submittedShopName = fd.get("shopName");
    const trimmedShopName =
      typeof submittedShopName === "string" ? submittedShopName.trim() : "";
    if (trimmedShopName) {
      const currentOrg = await db.organization.findUnique({
        where: { id: saveOrgId },
        select: { name: true },
      });
      if (currentOrg && currentOrg.name !== trimmedShopName) {
        await db.organization.update({
          where: { id: saveOrgId },
          data: { name: trimmedShopName },
        });
        await logActivity({
          orgId: saveOrgId,
          user: await getCurrentUser(),
          action: "settings.rename",
          entity: "organization",
          entityId: saveOrgId,
          summary: `Business name changed from "${currentOrg.name}" to "${trimmedShopName}"`,
        });
      }
    }
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
      if (typeof v === "string") {
        await setSetting(saveOrgId, k, k === "shopName" ? v.trim() : v);
      }
    }
    if (fd.get("reminderSettingsForm") === "1") {
      const reminderValues: Record<string, string> = {
        remindAppointmentsEnabled: fd.has("remindAppointmentsEnabled")
          ? "true"
          : "false",
        remindAppointmentsHoursBefore: String(
          Math.max(
            1,
            Math.min(
              168,
              Number(fd.get("remindAppointmentsHoursBefore")) || 24,
            ),
          ),
        ),
        remindPastDueEnabled: fd.has("remindPastDueEnabled")
          ? "true"
          : "false",
        remindPastDueDays: String(
          Math.max(1, Math.min(365, Number(fd.get("remindPastDueDays")) || 30)),
        ),
        remindServiceDueEnabled: fd.has("remindServiceDueEnabled")
          ? "true"
          : "false",
      };
      for (const [key, value] of Object.entries(reminderValues)) {
        await setSetting(saveOrgId, key, value);
      }
    }
    if (fd.get("weeklyReviewForm") === "1") {
      await setSetting(
        saveOrgId,
        "weeklyReviewEmailEnabled",
        fd.has("weeklyReviewEmailEnabled") ? "true" : "false",
      );
    }
    revalidatePath("/settings");
    revalidatePath("/", "layout");
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
      <Card className="mb-6 max-w-2xl">
        <CardHeader title="Appearance" />
        <div className="flex items-center justify-between gap-4 p-6">
          <p className="text-sm text-zinc-600">
            Choose the color theme for your Vultrix workspace.
          </p>
          <ThemeToggle initialTheme={theme} />
        </div>
        <AppearanceEditor
          initialPrefs={appearancePrefs}
          resetPrefs={accountDefaultAppearance}
        />
      </Card>
      <Card className="mb-6 max-w-2xl">
        <CardHeader title="Sidebar" />
        <NavLayoutEditor
          initialLayout={navLayout}
          resetLayout={accountDefaultNavLayout}
          items={eligibleNavItems}
        />
      </Card>
      {canManageOrgSettings && (
        <Card className="mb-6 max-w-2xl">
          <CardHeader title="Defaults for this account" />
          <div className="space-y-4 p-6">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Publish your current appearance, sidebar, or dashboard as the
              default for everyone in this account.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <form action={publishAppearanceDefault}>
                <Button type="submit" className="w-full">
                  Publish appearance
                </Button>
              </form>
              <form action={publishNavDefault}>
                <Button type="submit" className="w-full">
                  Publish sidebar
                </Button>
              </form>
              <form action={publishDashboardDefault}>
                <Button type="submit" className="w-full">
                  Publish dashboard
                </Button>
              </form>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <form action={clearAppearanceDefault}>
                <Button type="submit" variant="ghost" className="w-full">
                  Clear appearance
                </Button>
              </form>
              <form action={clearNavDefault}>
                <Button type="submit" variant="ghost" className="w-full">
                  Clear sidebar
                </Button>
              </form>
              <form action={clearDashboardDefault}>
                <Button type="submit" variant="ghost" className="w-full">
                  Clear dashboard
                </Button>
              </form>
            </div>
            <p className="text-xs text-zinc-500">
              Users who have their own saved preference keep their override.
              Resetting a preference returns it to this account default.
            </p>
          </div>
        </Card>
      )}
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
          <Field label="Business timezone">
            <TimezonePicker name="timezone" defaultValue={org.timezone} />
            <p className="mt-1 text-xs text-zinc-500">
              Appointment dates and scheduled reminder hours use this timezone.
            </p>
          </Field>
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

      {showReminderSettings && (
        <Card className="mt-6 max-w-2xl">
          <CardHeader title="Automatic reminders">
            <span className="text-xs text-zinc-500 font-normal">
              All reminders start turned off until you opt in.
            </span>
          </CardHeader>
          <form action={save} className="space-y-5 p-6">
            <input type="hidden" name="reminderSettingsForm" value="1" />
            {showAppointmentReminders && (
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="remindAppointmentsEnabled"
                    value="true"
                    defaultChecked={settings.remindAppointmentsEnabled === "true"}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Send appointment reminders
                </label>
                <Field label="Hours before appointment">
                  <Input
                    type="number"
                    name="remindAppointmentsHoursBefore"
                    min="1"
                    max="168"
                    defaultValue={settings.remindAppointmentsHoursBefore}
                  />
                </Field>
              </div>
            )}
            {showPastDueReminders && (
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="remindPastDueEnabled"
                    value="true"
                    defaultChecked={settings.remindPastDueEnabled === "true"}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Send past-due invoice reminders
                </label>
                <Field label="Days past invoice date">
                  <Input
                    type="number"
                    name="remindPastDueDays"
                    min="1"
                    max="365"
                    defaultValue={settings.remindPastDueDays}
                  />
                </Field>
              </div>
            )}
            {showServiceDueReminders && (
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    name="remindServiceDueEnabled"
                    value="true"
                    defaultChecked={settings.remindServiceDueEnabled === "true"}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Send service-due reminders
                </label>
                <p className="text-xs text-zinc-500">
                  These reminders use date-based due calculations; observed
                  mileage between visits is not used as a trigger.
                </p>
              </div>
            )}
            <p className="text-xs text-zinc-500">
              Reminders are checked once a day; dates and times use the business
              timezone.
            </p>
            {(!process.env.RESEND_API_KEY ||
              process.env.MAIL_FROM?.includes("onboarding@resend.dev")) && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {!process.env.RESEND_API_KEY
                  ? "Reminders will not reach customers until RESEND_API_KEY is configured."
                  : "Reminders are using Resend's onboarding sender. Set MAIL_FROM to a verified sender before sending to customers."}
              </p>
            )}
            <SaveButton>Save reminder settings</SaveButton>
          </form>
        </Card>
      )}

      {showWeeklyReview && (
        <Card className="mt-6 max-w-2xl">
          <CardHeader title="Weekly review">
            <span className="text-xs font-normal text-zinc-500">
              Optional Monday summary
            </span>
          </CardHeader>
          <form action={save} className="space-y-4 p-6">
            <input type="hidden" name="weeklyReviewForm" value="1" />
            <label className="flex items-center gap-3 text-sm text-zinc-800">
              <input
                type="checkbox"
                name="weeklyReviewEmailEnabled"
                value="true"
                defaultChecked={settings.weeklyReviewEmailEnabled === "true"}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Email me a weekly review on Monday
            </label>
            <p className="text-xs text-zinc-500">
              It will be sent to{" "}
              {settings.shopEmail ||
                org.billingEmail ||
                owner?.email ||
                "the owner email on your account"}
              .
            </p>
            <SaveButton>Save weekly review settings</SaveButton>
          </form>
        </Card>
      )}

      {canManageOrgSettings && (
        <Card className="mt-6 max-w-2xl">
          <CardHeader title="Activity log" />
          <div className="space-y-3 p-4">
            <p className="text-sm text-zinc-600">
              Review who created, changed, and removed records in your business.
            </p>
            <Link
              href="/settings/activity"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Open activity log →
            </Link>
          </div>
        </Card>
      )}

      {isPersonal && canManageOrgSettings && (
        <Card className="mt-6 max-w-2xl">
          <CardHeader title="AI assistant" />
          <form action={saveAiAssistantSettings} className="space-y-4 p-6">
            {sp.assistant_saved && (
              <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-900">
                AI assistant settings saved.
              </div>
            )}
            {sp.assistant_error && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
                {assistantErrorMessage(sp.assistant_error)}
              </div>
            )}
            <label className="flex items-center gap-3 text-sm text-zinc-800">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={org.aiAssistantEnabled}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Enable my assistant
            </label>
            <Field label="Assistant name">
              <Input
                name="assistantName"
                defaultValue={org.aiAssistantName}
                placeholder="Assistant"
                maxLength={80}
                required
              />
              <p className="mt-1 text-xs text-zinc-500">
                This name will become the assistant&apos;s wake word later.
              </p>
            </Field>
            <Field label="Response voice">
              <VoicePicker defaultValue={org.aiAssistantVoice ?? ""} />
              <p className="mt-1 text-xs text-zinc-500">
                Voices come from your browser and may vary by device.
              </p>
            </Field>
            <Field label="Backend">
              <Select name="provider" defaultValue={org.aiAssistantProvider}>
                <option value="OPENAI" disabled={!aiKeyConfigured}>
                  My own key — OpenAI
                </option>
                <option value="ANTHROPIC" disabled={!aiKeyConfigured}>
                  My own key — Anthropic
                </option>
              </Select>
              {!aiKeyConfigured && (
                <p className="mt-1 text-xs text-amber-700">
                  Own-key backends are unavailable until AI_KEY_SECRET is
                  configured.
                </p>
              )}
            </Field>
            <Field label="Own API key (write-only)">
              <Input
                type="password"
                name="apiKey"
                placeholder={
                  org.aiAssistantApiKeyEncrypted
                    ? "Enter a new key to replace the saved key"
                    : "Paste an OpenAI or Anthropic key"
                }
                autoComplete="new-password"
                disabled={!aiKeyConfigured}
              />
              <p className="mt-1 text-xs text-zinc-500">
                {org.aiAssistantApiKeyEncrypted
                  ? "A key is saved. The existing key is never shown."
                  : "No key is currently saved."}
              </p>
              {org.aiAssistantApiKeyEncrypted && (
                <label className="mt-2 flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    name="clearApiKey"
                    className="h-3.5 w-3.5 rounded border-zinc-300"
                  />
                  Clear saved key
                </label>
              )}
            </Field>
            <SaveButton>Save assistant settings</SaveButton>
          </form>
        </Card>
      )}

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

    </>
  );
}

function assistantErrorMessage(code: string): string {
  switch (code) {
    case "not_allowed":
      return "Only an owner or manager can change assistant settings.";
    case "key_unavailable":
      return "Own-key storage is unavailable until AI_KEY_SECRET is configured.";
    case "key_required":
      return "Add an API key before selecting an own-key backend.";
    case "personal_only":
      return "AI assistant settings are currently available for personal accounts only.";
    case "invalid":
      return "Check the assistant settings and try again.";
    default:
      return "The assistant settings could not be saved.";
  }
}
