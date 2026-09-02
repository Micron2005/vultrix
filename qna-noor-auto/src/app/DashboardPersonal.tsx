import type { ReactNode } from "react";
import { LinkButton, PageHeader } from "@/components/ui";
import type { CurrentUser } from "@/lib/session";
import type { FeatureKey } from "@/lib/features";
import { db } from "@/lib/db";
import { enabledFeatureSet, repairOrderNouns } from "@/lib/features";
import { orgTimeZone } from "@/lib/orgTimezone";
import {
  DASHBOARD_BLOCKS,
  resolveDashboardLayout,
  type DashboardBlockId,
} from "@/lib/dashboard";
import { DashboardGrid } from "./DashboardGrid";
import { GoalsBlock } from "./dashboard-blocks/GoalsBlock";
import { LowStockBlock } from "./dashboard-blocks/LowStockBlock";
import { NotesBlock } from "./dashboard-blocks/NotesBlock";
import { QuickAddBlock } from "./dashboard-blocks/QuickAddBlock";
import { ScheduleBlock } from "./dashboard-blocks/ScheduleBlock";
import { SpendingBlock } from "./dashboard-blocks/SpendingBlock";
import { StatsBlock } from "./dashboard-blocks/StatsBlock";
import { TodayBlock } from "./dashboard-blocks/TodayBlock";
import { TopProductsBlock } from "./dashboard-blocks/TopProductsBlock";
import { CountsBlock } from "./dashboard-blocks/CountsBlock";
import { VehiclesDueBlock } from "./dashboard-blocks/VehiclesDueBlock";
import { TechHoursBlock } from "./dashboard-blocks/TechHoursBlock";
import { OutstandingBlock } from "./dashboard-blocks/OutstandingBlock";
import { RecentRecordsBlock } from "./dashboard-blocks/RecentRecordsBlock";

type SearchParams = Promise<{
  customize?: string | string[];
}>;

function hasRequiredFeatures(
  id: DashboardBlockId,
  requires: FeatureKey[],
  features: ReturnType<typeof enabledFeatureSet>,
  user: CurrentUser,
): boolean {
  const autoShop = (user.accountType ?? "AUTO_SHOP") === "AUTO_SHOP";
  const hasRecords =
    features.has("repair_orders") || features.has("invoices");
  const showMoneyCards =
    user.role !== "STAFF" &&
    ((features.has("financials") && hasRecords) || features.has("invoices"));
  if (
    user.accountType === "PERSONAL" &&
    (id === "counts" || id === "outstanding" || id === "recent_records")
  ) {
    return false;
  }
  if (id === "outstanding" && !showMoneyCards) {
    return false;
  }
  if (
    id === "today" &&
    user.role === "STAFF" &&
    user.accountType !== "PERSONAL"
  ) {
    return false;
  }
  if (
    id === "recent_records" &&
    !features.has("repair_orders") &&
    !features.has("invoices")
  ) {
    return false;
  }
  if (!requires.every((feature) => features.has(feature))) {
    return false;
  }
  if (
    (id === "stats" || id === "spending") &&
    user.role === "STAFF"
  ) {
    return false;
  }
  if (id === "stats" && features.has("invoices")) {
    return false;
  }
  if (id === "goals" && user.role === "STAFF") {
    return false;
  }
  if (
    id === "notes" &&
    (user.role === "STAFF" && user.accountType === "PERSONAL" ||
      autoShop ||
      showMoneyCards)
  ) {
    return false;
  }
  if (id === "top_products") {
    return (
      user.role !== "STAFF" &&
      features.has("financials") &&
      !features.has("invoices")
    );
  }
  return true;
}

async function blockNode(
  id: DashboardBlockId,
  props: {
    orgId: string;
    timezone: string;
    hasInvoices: boolean;
    showMoneyCards: boolean;
    features: ReturnType<typeof enabledFeatureSet>;
    user: CurrentUser;
    editing: boolean;
    hasVehicles: boolean;
  },
): Promise<ReactNode> {
  switch (id) {
    case "today":
      return (
        <TodayBlock
          orgId={props.orgId}
          timezone={props.timezone}
          hasInvoices={props.hasInvoices}
        />
      );
    case "counts":
      return <CountsBlock orgId={props.orgId} user={props.user} />;
    case "stats":
      return (
        <StatsBlock orgId={props.orgId} hasInvoices={props.hasInvoices} />
      );
    case "goals":
      return (
        <GoalsBlock
          orgId={props.orgId}
          timezone={props.timezone}
          hasInvoices={props.hasInvoices}
          accountType={props.user.accountType}
          role={props.user.role}
          editing={props.editing}
        />
      );
    case "schedule":
      return (
        <ScheduleBlock
          orgId={props.orgId}
          timezone={props.timezone}
          accountType={props.user.accountType}
          hasVehicles={props.hasVehicles}
        />
      );
    case "notes":
      return (
        <NotesBlock
          orgId={props.orgId}
          showMoneyCards={props.showMoneyCards}
        />
      );
    case "spending":
      return <SpendingBlock orgId={props.orgId} timezone={props.timezone} />;
    case "top_products":
      return <TopProductsBlock orgId={props.orgId} timezone={props.timezone} />;
    case "low_stock":
      return <LowStockBlock orgId={props.orgId} />;
    case "vehicles_due":
      return <VehiclesDueBlock orgId={props.orgId} />;
    case "tech_hours":
      return <TechHoursBlock orgId={props.orgId} />;
    case "outstanding":
      return (
        <OutstandingBlock
          orgId={props.orgId}
          autoShop={(props.user.accountType ?? "AUTO_SHOP") === "AUTO_SHOP"}
          hasVehicles={props.hasVehicles}
        />
      );
    case "recent_records":
      return (
        <RecentRecordsBlock
          orgId={props.orgId}
          autoShop={(props.user.accountType ?? "AUTO_SHOP") === "AUTO_SHOP"}
          nouns={repairOrderNouns(props.user.accountType)}
          hasVehicles={props.hasVehicles}
        />
      );
    case "quick_add":
      return (
        <QuickAddBlock
          features={props.features}
          salesAvailable={
            props.user.role !== "STAFF" &&
            props.features.has("financials") &&
            !props.features.has("invoices")
          }
        />
      );
  }
}

export async function DashboardPersonal({
  user,
  searchParams,
}: {
  user: CurrentUser;
  searchParams: SearchParams;
}) {
  const orgId = user.orgId as string;
  const [timezone, layoutRecord, orgRecord] = await Promise.all([
    orgTimeZone(orgId),
    db.user.findUnique({
      where: { id: user.id },
      select: { dashLayout: true },
    }),
    db.organization.findUnique({
      where: { id: orgId },
      select: { dashDefault: true },
    }),
  ]);
  const features = enabledFeatureSet(user);
  const layout = resolveDashboardLayout(
    layoutRecord?.dashLayout,
    orgRecord?.dashDefault,
    user.accountType,
  );
  const accountDefaultLayout = resolveDashboardLayout(
    null,
    orgRecord?.dashDefault,
    user.accountType,
  );
  const params = await searchParams;
  const editing =
    params.customize === "1" ||
    (Array.isArray(params.customize) && params.customize.includes("1"));
  const available = DASHBOARD_BLOCKS.filter((block) =>
    hasRequiredFeatures(block.id, block.requires, features, user),
  );
  const availableIds = new Set(available.map((block) => block.id));
  const renderableBlocks = layout.blocks.filter(
    (block) => availableIds.has(block.id) && (editing || block.visible),
  );
  const nodes = await Promise.all(
    renderableBlocks.map((block) =>
      blockNode(block.id, {
        orgId,
        timezone,
        hasInvoices: features.has("invoices"),
        showMoneyCards:
          user.role !== "STAFF" &&
          ((features.has("financials") &&
            (features.has("repair_orders") || features.has("invoices"))) ||
            features.has("invoices")),
        features,
        user,
        editing,
        hasVehicles: features.has("vehicles"),
      }),
    ),
  );
  const blockDescriptors = renderableBlocks.map((block, index) => {
    const definition = available.find((candidate) => candidate.id === block.id);
    return {
      id: block.id,
      label: definition?.label ?? block.id,
      hint: definition?.hint ?? "",
      node: nodes[index],
      wide: definition?.wide,
    };
  });
  const nouns = repairOrderNouns(user.accountType);
  const hasRecords =
    features.has("repair_orders") || features.has("invoices");
  const autoShop = (user.accountType ?? "AUTO_SHOP") === "AUTO_SHOP";

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          autoShop
            ? "Overview of shop activity"
            : user.accountType === "BUSINESS"
              ? "Overview of your activity"
              : "Plan your day and keep your important notes close"
        }
        actions={
          <>
            {hasRecords && (
              <LinkButton href="/repair-orders/new">
                {autoShop
                  ? "New Repair Order"
                  : `New ${nouns.singular.toLowerCase()}`}
              </LinkButton>
            )}
            <LinkButton
              href={editing ? "/" : "/?customize=1"}
              variant="secondary"
            >
              {editing ? "Done" : "Customize"}
            </LinkButton>
          </>
        }
      />
      <DashboardGrid
        layout={layout}
        resetLayout={accountDefaultLayout}
        blocks={blockDescriptors}
        editing={editing}
      />
    </>
  );
}
