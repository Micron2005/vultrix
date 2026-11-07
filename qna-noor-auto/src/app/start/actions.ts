"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { enabledFeatureSet } from "@/lib/features";
import { metricAllowed } from "@/lib/goalAvailability";
import { applyTemplateForOrg } from "@/lib/goalTemplateApply";
import { assertCanViewFinancials } from "@/lib/permissions";
import { requireOrgId, requireUser } from "@/lib/session";
import { getNextRoNumber, getSetting } from "@/lib/shop";
import { fullName, parseDecimal } from "@/lib/utils";
import { newToken } from "@/app/repair-orders/share";
import {
  normalizeGoalTemplateAccountType,
  templatesFor,
} from "@/lib/goalTemplates";

function field(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export async function createFirstInvoice(fd: FormData) {
  const user = await requireUser();
  if (user.role !== "OWNER" && user.role !== "ADMIN") redirect("/");
  if (
    user.accountType !== "BUSINESS" ||
    !user.features.includes("invoices")
  ) {
    redirect("/");
  }
  const orgId = await requireOrgId();

  const firstName = field(fd, "firstName");
  const lastName = field(fd, "lastName");
  const companyName = field(fd, "companyName");
  const email = field(fd, "email");
  const phone = field(fd, "phone");
  const description = field(fd, "description");
  const amountValue = field(fd, "amount");
  const amount = amountValue ? Number(amountValue) : Number.NaN;

  if (
    !firstName ||
    !description ||
    amount <= 0 ||
    !Number.isFinite(amount) ||
    Math.round(amount * 100) <= 0 ||
    firstName.length > 120 ||
    lastName.length > 120 ||
    companyName.length > 200 ||
    email.length > 254 ||
    phone.length > 80 ||
    description.length > 2000
  ) {
    redirect("/start?error=invoice");
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect("/start?error=email");
  }

  const customer = await db.customer.create({
    data: {
      orgId,
      firstName,
      lastName,
      companyName: companyName || null,
      type: companyName ? "BUSINESS" : "INDIVIDUAL",
      email: email || null,
      phone: phone || null,
    },
  });
  const roNumber = await getNextRoNumber(orgId);
  const defaultTax = parseDecimal(await getSetting(orgId, "defaultTaxRate")) ?? 0;
  const now = new Date();
  const shareToken = await newToken();
  const invoice = await db.$transaction((tx) =>
    tx.repairOrder.create({
      data: {
        orgId,
        customerId: customer.id,
        roNumber,
        status: "INVOICED",
        invoicedAt: now,
        closedAt: now,
        complaint: description,
        taxRate: defaultTax,
        shareToken,
        feeLines: {
          create: {
            description,
            amount: Math.round(amount * 100) / 100,
            sortOrder: 1,
          },
        },
      },
    }),
  );

  await logActivity({
    orgId,
    user,
    action: "repair_order.create",
    entity: "RepairOrder",
    entityId: invoice.id,
    summary: `RO #${invoice.roNumber} created for ${fullName(customer)}`,
  });
  revalidatePath("/repair-orders");
  revalidatePath("/");
  revalidatePath("/customers");
  redirect(`/start?invoice=${invoice.id}`);
}

export async function startFirstRoutine(fd: FormData) {
  const user = await requireUser();
  if (user.role === "STAFF") redirect("/");
  assertCanViewFinancials(user.role);
  const orgId = await requireOrgId();
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    select: { accountType: true, features: true, focusPacks: true },
  });
  const accountType =
    organization?.accountType ?? user.accountType ?? "AUTO_SHOP";
  if (accountType !== "PERSONAL") redirect("/");

  const features = enabledFeatureSet({
    accountType,
    features: organization?.features ?? user.features,
  });
  const focusPacks = organization?.focusPacks ?? user.focusPacks;
  const template = templatesFor(
    normalizeGoalTemplateAccountType(accountType),
    (metric) => metricAllowed(metric, { accountType, features, focusPacks }),
    focusPacks,
  ).find(
    (candidate) =>
      candidate.id === field(fd, "templateId") && Boolean(candidate.routine),
  );
  if (!template) redirect("/start?error=template");

  const result = await applyTemplateForOrg({ orgId, user, template });
  if (result.kind !== "routine") redirect("/start?error=template");
  revalidatePath("/goals");
  revalidatePath("/");
  revalidatePath("/start");
  redirect(`/start?routine=${result.id}`);
}
