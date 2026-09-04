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
  type DashboardLayout,
} from "@/lib/dashboard";
import { resolveNavLayout } from "@/lib/navLayout";
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
import { GetStartedCard } from "./dashboard-blocks/GetStartedCard";
import { loadOnboarding } from "@/lib/onboarding";

type SearchParams = Promise<{
  customize?: string | string[];
}>;

type DashboardContext = {
  accountType: CurrentUser["accountType"];
  autoShop: boolean;
  role: CurrentUser["role"];
  features: ReturnType<typeof enabledFeatureSet>;
  hasRecords: boolean;
  hasInvoices: boolean;
  hasVehicles: boolean;
  showMoneyCards: boolean;
};

function hasRequiredFeatures(
  id: DashboardBlockId,
  requires: FeatureKey[],
  context: DashboardContext,
): boolean {
  if (
    context.accountType === "PERSONAL" &&
    (id === "counts" || id === "outstanding" || id === "recent_records")
  ) {
    return false;
  }
  if (id === "outstanding" && !context.showMoneyCards) {
    return false;
  }
  if (
    id === "today" &&
    context.role === "STAFF" &&
    context.accountType !== "PERSONAL"
  ) {
    return false;
  }
  if (
    id === "recent_records" &&
    !context.features.has("repair_orders") &&
    !context.features.has("invoices")
  ) {
    return false;
  }
  if (!requires.every((feature) => context.features.has(feature))) {
    return false;
  }
  if (
    (id === "stats" || id === "spending") &&
    context.role === "STAFF"
  ) {
    return false;
  }
  if (id === "stats" && context.features.has("invoices")) {
    return false;
  }
  if (id === "goals" && context.role === "STAFF") {
    return false;
  }
  if (
    id === "notes" &&
    (
      (context.role === "STAFF" && context.accountType === "PERSONAL") ||
      context.autoShop ||
      context.showMoneyCards
    )
  ) {
    return false;
  }
  if (id === "top_products") {
    return (
      context.role !== "STAFF" &&
      context.features.has("financials") &&
      !context.features.has("invoices")
    );
  }
  return true;
}

async function blockNode(
  id: DashboardBlockId,
  props: {
    orgId: string;
    timezone: string;
    context: DashboardContext;
    user: CurrentUser;
    editing: boolean;
    entry: DashboardLayout["blocks"][number];
  },
): Promise<ReactNode> {
  const { context } = props;
  const title = props.entry.title ?? undefined;
  const options = props.entry.options;
  switch (id) {
    case "today":
      return (
        <TodayBlock
          orgId={props.orgId}
          timezone={props.timezone}
          hasInvoices={context.hasInvoices}
          title={title}
        />
      );
    case "counts":
      return <CountsBlock orgId={props.orgId} user={props.user} />;
    case "stats":
      return (
        <StatsBlock
          orgId={props.orgId}
          timezone={props.timezone}
          hasInvoices={context.hasInvoices}
          period={options.period}
        />
      );
    case "goals":
      return (
        <GoalsBlock
          orgId={props.orgId}
          timezone={props.timezone}
          hasInvoices={context.hasInvoices}
          accountType={context.accountType}
          role={context.role}
          editing={props.editing}
          title={title}
        />
      );
    case "schedule":
      return (
        <ScheduleBlock
          orgId={props.orgId}
          timezone={props.timezone}
          accountType={context.accountType}
          hasVehicles={context.hasVehicles}
          title={title}
          window={options.window}
        />
      );
    case "notes":
      return (
        <NotesBlock
          orgId={props.orgId}
          showMoneyCards={context.showMoneyCards}
          count={Number(options.count)}
          title={title}
        />
      );
    case "spending":
      return (
        <SpendingBlock orgId={props.orgId} timezone={props.timezone} title={title} />
      );
    case "top_products":
      return (
        <TopProductsBlock
          orgId={props.orgId}
          timezone={props.timezone}
          title={title}
        />
      );
    case "low_stock":
      return (
        <LowStockBlock
          orgId={props.orgId}
          limit={options.limit}
          title={title}
        />
      );
    case "vehicles_due":
      return <VehiclesDueBlock orgId={props.orgId} title={title} />;
    case "tech_hours":
      return <TechHoursBlock orgId={props.orgId} title={title} />;
    case "outstanding":
      return (
        <OutstandingBlock
          orgId={props.orgId}
          autoShop={context.autoShop}
          hasVehicles={context.hasVehicles}
          title={title}
        />
      );
    case "recent_records":
      return (
        <RecentRecordsBlock
          orgId={props.orgId}
          autoShop={context.autoShop}
          nouns={repairOrderNouns(context.accountType)}
          hasVehicles={context.hasVehicles}
          take={Number(options.count)}
          title={title}
        />
      );
    case "quick_add":
      return (
        <QuickAddBlock
          features={context.features}
          salesAvailable={
            context.role !== "STAFF" &&
            context.features.has("financials") &&
            !context.features.has("invoices")
          }
          title={title}
        />
      );
  }
}

export async function Dashboard({
  user,
  searchParams,
}: {
  user: CurrentUser;
  searchParams: SearchParams;
}) {
  const orgId = user.orgId as string;
  const [timezone, layoutRecord, orgRecord, onboarding] = await Promise.all([
    orgTimeZone(orgId),
    db.user.findUnique({
      where: { id: user.id },
      select: { dashLayout: true, navLayout: true },
    }),
    db.organization.findUnique({
      where: { id: orgId },
      select: { dashDefault: true, navDefault: true },
    }),
    loadOnboarding(user),
  ]);
  const features = enabledFeatureSet(user);
  const context: DashboardContext = {
    accountType: user.accountType,
    autoShop: (user.accountType ?? "AUTO_SHOP") === "AUTO_SHOP",
    role: user.role,
    features,
    hasRecords: features.has("repair_orders") || features.has("invoices"),
    hasInvoices: features.has("invoices"),
    hasVehicles: features.has("vehicles"),
    showMoneyCards:
      user.role !== "STAFF" &&
      ((features.has("financials") &&
        (features.has("repair_orders") || features.has("invoices"))) ||
        features.has("invoices")),
  };
  const layout = resolveDashboardLayout(
    layoutRecord?.dashLayout,
    orgRecord?.dashDefault,
    user.accountType,
  );
  const navLayout = resolveNavLayout(
    layoutRecord?.navLayout,
    orgRecord?.navDefault,
    {
      accountType: user.accountType,
      enabledFeatures: features,
    },
  );
  const renderedLayout =
    navLayout.mode === "top"
      ? {
          ...layout,
          blocks: layout.blocks.map((block) => ({ ...block, visible: true })),
        }
      : layout;
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
    hasRequiredFeatures(block.id, block.requires, context),
  );
  const availableIds = new Set(available.map((block) => block.id));
  const renderableBlocks = renderedLayout.blocks.filter(
    (block) => availableIds.has(block.id) && (editing || block.visible),
  );
  const nodes = await Promise.all(
    renderableBlocks.map((block) => {
      const definition = available.find((candidate) => candidate.id === block.id);
      if (!definition) return null;
      return blockNode(block.id, {
        orgId,
        timezone,
        context,
        user,
        editing,
        entry: block,
      });
    }),
  );
  const blockDescriptors = renderableBlocks.map((block, index) => {
    const definition = available.find((candidate) => candidate.id === block.id);
    return {
      id: block.id,
      label: definition?.label ?? block.id,
      hint: definition?.hint ?? "",
      node: nodes[index],
      size: block.size,
      title: block.title,
      settings: definition?.settings ?? [],
      collapsed: block.collapsed,
    };
  });
  const nouns = repairOrderNouns(user.accountType);
  const defaultGreeting = context.autoShop
    ? "Overview of shop activity"
    : user.accountType === "BUSINESS"
      ? "Overview of your activity"
      : "Plan your day and keep your important notes close";
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          layout.greeting.show
            ? (layout.greeting.text ?? defaultGreeting)
            : undefined
        }
        actions={
          <>
            {context.hasRecords && (
              <LinkButton href="/repair-orders/new">
                {context.autoShop
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
      {!editing && onboarding && <GetStartedCard {...onboarding} />}
      <DashboardGrid
        layout={renderedLayout}
        resetLayout={accountDefaultLayout}
        blocks={blockDescriptors}
        editing={editing}
        defaultGreeting={defaultGreeting}
        allowHide={navLayout.mode !== "top"}
      />
    </>
  );
}
