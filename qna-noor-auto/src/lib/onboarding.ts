import "server-only";

import { db } from "@/lib/db";
import { enabledFeatureSet, type FeatureKey } from "@/lib/features";
import type { CurrentUser } from "@/lib/session";

export type OnboardingStep = {
  id: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
};

type OnboardingResult = {
  steps: OnboardingStep[];
  total: number;
  doneCount: number;
};

export async function loadOnboarding(
  user: CurrentUser,
): Promise<OnboardingResult | null> {
  if (user.role === "STAFF" || !user.orgId) return null;

  const orgId = user.orgId;
  const features = enabledFeatureSet(user);
  const [
    organization,
    shopSettings,
    customerCount,
    vehicleCount,
    repairOrderCount,
    saleCount,
    expenseCount,
    incomeCount,
    goalCount,
    routineCount,
    calendarEventCount,
    appointmentCount,
    repairNoteCount,
    userCount,
    appearance,
  ] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: {
        accountType: true,
        onboardingDismissedAt: true,
        stripeConnectChargesEnabled: true,
        aiAssistantEnabled: true,
      },
    }),
    db.shopSetting.findMany({
      where: { orgId, key: { in: ["shopAddress", "shopPhone"] } },
      select: { key: true, value: true },
    }),
    db.customer.count({ where: { orgId } }),
    db.vehicle.count({ where: { orgId } }),
    db.repairOrder.count({ where: { orgId } }),
    db.sale.count({ where: { orgId } }),
    db.expense.count({ where: { orgId } }),
    db.income.count({ where: { orgId } }),
    db.goal.count({ where: { orgId } }),
    db.routine.count({ where: { orgId } }),
    db.calendarEvent.count({ where: { orgId } }),
    db.appointment.count({ where: { orgId } }),
    db.repairNote.count({ where: { orgId } }),
    db.user.count({ where: { orgId } }),
    db.user.findUnique({
      where: { id: user.id },
      select: {
        uiPalette: true,
        uiAccent: true,
        dashLayout: true,
        navLayout: true,
      },
    }),
  ]);

  if (!organization || organization.onboardingDismissedAt) return null;

  const shopInfoDone = shopSettings.some((setting) => setting.value.trim() !== "");
  const goalsDone = goalCount > 0 || routineCount > 0;
  const steps: OnboardingStep[] = [];
  const addStep = (step: OnboardingStep, feature?: FeatureKey) => {
    if (!feature || features.has(feature)) {
      steps.push(step);
    }
  };
  const step = (
    id: string,
    label: string,
    hint: string,
    href: string,
    done: boolean,
  ): OnboardingStep => ({ id, label, hint, href, done });

  const accountType = organization.accountType ?? user.accountType ?? "AUTO_SHOP";
  if (accountType === "BUSINESS") {
    addStep(
      step(
        "shop_info",
        "Add your business details",
        "Name, address and phone go on every estimate and invoice.",
        "/settings",
        shopInfoDone,
      ),
    );
    addStep(step("customer", "Add your first customer", "", "/customers", customerCount > 0), "customers");
    if (features.has("invoices")) {
      addStep(
        step(
          "first_record",
          "Send your first invoice",
          "",
          "/repair-orders",
          repairOrderCount > 0,
        ),
        "invoices",
      );
    } else if (features.has("financials")) {
      addStep(
        step("first_record", "Record your first sale", "", "/sales", saleCount > 0),
        "financials",
      );
    }
    addStep(
      step(
        "expense",
        "Log an expense",
        "Financials and reports start making sense once money in and out is tracked.",
        "/expenses",
        expenseCount > 0 || incomeCount > 0,
      ),
      "financials",
    );
    addStep(step("goal", "Set a goal", "", "/goals", goalsDone));
    addStep(step("staff", "Add a login for your team", "", "/settings/users", userCount > 1));
  } else if (accountType === "PERSONAL") {
    addStep(
      step(
        "appearance",
        "Make it yours",
        "Colors, dark mode, text size and which cards show on your dashboard.",
        "/settings",
        Boolean(
          appearance?.uiPalette ||
            appearance?.uiAccent ||
            appearance?.dashLayout ||
            appearance?.navLayout,
        ),
      ),
    );
    addStep(
      step(
        "event",
        "Put something on your calendar",
        "",
        "/appointments",
        calendarEventCount > 0 || appointmentCount > 0,
      ),
    );
    addStep(
      step(
        "goal",
        "Create a goal or routine",
        "One-day reminders, checklists, workouts with rest timers, or a number to hit.",
        "/goals",
        goalsDone,
      ),
    );
    addStep(
      step("money", "Log income or an expense", "", "/expenses", incomeCount > 0 || expenseCount > 0),
      "financials",
    );
    addStep(step("note", "Save a note", "", "/notes", repairNoteCount > 0), "knowledge");
    if (!organization.aiAssistantEnabled) {
      addStep(
        step(
          "assistant",
          "Set up the AI assistant",
          "Bring your own API key; it can add events, notes and expenses for you.",
          "/settings",
          organization.aiAssistantEnabled,
        ),
      );
    }
  } else {
    addStep(
      step(
        "shop_info",
        "Add your shop details",
        "Name, address and phone go on every estimate and invoice.",
        "/settings",
        shopInfoDone,
      ),
    );
    addStep(step("customer", "Add your first customer", "", "/customers", customerCount > 0), "customers");
    addStep(step("vehicle", "Add a vehicle", "", "/vehicles", vehicleCount > 0), "vehicles");
    addStep(
      step(
        "repair_order",
        "Write your first repair order",
        "Estimate → repair order → invoice, all from one ticket.",
        "/repair-orders",
        repairOrderCount > 0,
      ),
      "repair_orders",
    );
    addStep(
      step(
        "online_pay",
        "Turn on online payments",
        "Customers pay estimates, deposits and invoices by card or Apple Pay from a link.",
        "/billing",
        organization.stripeConnectChargesEnabled,
      ),
    );
    addStep(step("staff", "Add a login for your staff", "", "/settings/users", userCount > 1));
    addStep(
      step(
        "goal",
        "Set a goal for the shop",
        "Weekly revenue, cars out the door, opening checklist — pick a starter.",
        "/goals",
        goalsDone,
      ),
    );
  }

  if (steps.length === 0) return null;
  const doneCount = steps.filter((item) => item.done).length;
  return doneCount === steps.length ? null : { steps, total: steps.length, doneCount };
}
