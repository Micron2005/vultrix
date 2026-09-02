"use server";

import { revalidatePath } from "next/cache";
import {
  canManageUsers,
  requireUser,
  type CurrentUser,
} from "@/lib/session";
import { canViewFinancials } from "@/lib/permissions";
import { enabledFeatureSet } from "@/lib/features";
import { db } from "@/lib/db";
import { resolveAppearance } from "@/lib/appearance";
import {
  resolveNavLayout,
  serializeNavLayout,
} from "@/lib/navLayout";
import {
  resolveDashboardLayout,
  serializeDashboardLayout,
} from "@/lib/dashboard";

async function requireOrgSettingsUser(): Promise<
  CurrentUser & { orgId: string }
> {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    throw new Error("You don't have permission to do that");
  }
  if (!user.orgId) throw new Error("Organization required");
  return { ...user, orgId: user.orgId };
}

async function revalidateDefaults() {
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function publishAppearanceDefault() {
  const user = await requireOrgSettingsUser();
  const [record, organization] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: {
        uiPalette: true,
        uiAccent: true,
        uiScale: true,
        uiRadius: true,
        uiFont: true,
      },
    }),
    db.organization.findUnique({
      where: { id: user.orgId },
      select: { uiDefaults: true },
    }),
  ]);
  const appearance = resolveAppearance(record, organization?.uiDefaults);
  await db.organization.update({
    where: { id: user.orgId },
    data: { uiDefaults: JSON.stringify(appearance) },
  });
  await revalidateDefaults();
}

export async function clearAppearanceDefault() {
  const user = await requireOrgSettingsUser();
  await db.organization.update({
    where: { id: user.orgId },
    data: { uiDefaults: null },
  });
  await revalidateDefaults();
}

export async function publishNavDefault() {
  const user = await requireOrgSettingsUser();
  const [record, organization] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { navLayout: true },
    }),
    db.organization.findUnique({
      where: { id: user.orgId },
      select: { navDefault: true },
    }),
  ]);
  const enabledFeatures = enabledFeatureSet(user);
  const options = {
    accountType: user.accountType,
    enabledFeatures,
    canViewFinancials: canViewFinancials(user.role),
    canManageUsers: canManageUsers(user.role),
    aiAssistantEnabled:
      user.accountType === "PERSONAL" && user.aiAssistantEnabled,
  };
  const layout = resolveNavLayout(
    record?.navLayout,
    organization?.navDefault,
    options,
  );
  await db.organization.update({
    where: { id: user.orgId },
    data: { navDefault: serializeNavLayout(layout) },
  });
  await revalidateDefaults();
}

export async function clearNavDefault() {
  const user = await requireOrgSettingsUser();
  await db.organization.update({
    where: { id: user.orgId },
    data: { navDefault: null },
  });
  await revalidateDefaults();
}

export async function publishDashboardDefault() {
  const user = await requireOrgSettingsUser();
  const [record, organization] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { dashLayout: true },
    }),
    db.organization.findUnique({
      where: { id: user.orgId },
      select: { dashDefault: true },
    }),
  ]);
  const layout = resolveDashboardLayout(
    record?.dashLayout,
    organization?.dashDefault,
  );
  await db.organization.update({
    where: { id: user.orgId },
    data: { dashDefault: serializeDashboardLayout(layout) },
  });
  await revalidateDefaults();
}

export async function clearDashboardDefault() {
  const user = await requireOrgSettingsUser();
  await db.organization.update({
    where: { id: user.orgId },
    data: { dashDefault: null },
  });
  await revalidateDefaults();
}
