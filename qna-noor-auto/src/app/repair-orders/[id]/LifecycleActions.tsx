import { LocalDateTime } from "@/components/LocalDateTime";
import { LinkButton, StatusBadge } from "@/components/ui";
import { revertInvoiceToRepairOrder, transitionRepairOrder } from "../actions";
import { PaidActions } from "./PaidActions";

type Status =
  | "ESTIMATE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "INVOICED"
  | "PAID"
  | "CANCELLED";

/**
 * Primary action buttons keyed to current RO status.
 * Estimate → Work Order → Complete → Invoice → Paid.
 */
export function LifecycleActions({
  id,
  status,
  roNumber,
  cleared = false,
  canManagePayments = true,
}: {
  id: string;
  status: string;
  roNumber: number;
  cleared?: boolean;
  canManagePayments?: boolean;
}) {
  const current = status as Status;
  const go = (target: Status) => transitionRepairOrder.bind(null, id, target);

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <StatusBadge status={current} />
      {current === "PAID" && cleared && (
        <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 text-xs font-medium px-2.5 py-0.5 border border-zinc-300">
          Cleared
        </span>
      )}

      {current === "ESTIMATE" && (
        <>
          <LinkButton
            href={`/repair-orders/${id}/invoice?type=estimate`}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer"
          >
            Print Estimate
          </LinkButton>
          <form action={go("IN_PROGRESS")}>
            <button className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-blue-600 text-white hover:bg-blue-700">
              Convert to Work Order →
            </button>
          </form>
        </>
      )}

      {current === "IN_PROGRESS" && (
        <>
          <LinkButton
            href={`/repair-orders/${id}/invoice?type=estimate`}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer"
          >
            Print Estimate
          </LinkButton>
          <form action={go("COMPLETED")}>
            <button className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-emerald-600 text-white hover:bg-emerald-700">
              Mark Complete →
            </button>
          </form>
        </>
      )}

      {current === "COMPLETED" && (
        <>
          <LinkButton
            href={`/repair-orders/${id}/invoice?type=estimate`}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer"
          >
            Print Estimate
          </LinkButton>
          <form action={go("INVOICED")}>
            <button className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-indigo-600 text-white hover:bg-indigo-700">
              Generate Invoice →
            </button>
          </form>
        </>
      )}

      {current === "INVOICED" && (
        <>
          <LinkButton
            href={`/repair-orders/${id}/invoice`}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer"
          >
            Invoice PDF
          </LinkButton>
          <form action={revertInvoiceToRepairOrder.bind(null, id)}>
            <button className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-white text-zinc-700 border border-zinc-300 hover:border-zinc-400">
              ← Revert to Repair Order
            </button>
          </form>
          {canManagePayments && <form action={go("PAID")}>
            <button className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-green-600 text-white hover:bg-green-700">
              Mark Paid ✓
            </button>
          </form>}
        </>
      )}

      {current === "PAID" && (
        <>
          <LinkButton
            href={`/repair-orders/${id}/invoice`}
            variant="secondary"
            size="sm"
            target="_blank"
            rel="noreferrer"
          >
            Invoice PDF
          </LinkButton>
          {canManagePayments && <PaidActions id={id} cleared={cleared} />}
        </>
      )}

      {current === "CANCELLED" && (
        <form action={go("ESTIMATE")}>
          <button className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-zinc-900 text-white hover:bg-zinc-800">
            Reopen as Estimate
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * Renders the lifecycle timeline (set of timestamps) for this RO.
 */
export function LifecycleTimeline({
  ro,
}: {
  ro: {
    openedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    invoicedAt: Date | null;
    paidAt: Date | null;
    cancelledAt: Date | null;
  };
}) {
  const events: { label: string; at: Date | null; color: string }[] = [
    { label: "Opened as estimate", at: ro.openedAt, color: "bg-zinc-400" },
    { label: "Work started", at: ro.startedAt, color: "bg-blue-500" },
    { label: "Work completed", at: ro.completedAt, color: "bg-emerald-500" },
    { label: "Invoiced", at: ro.invoicedAt, color: "bg-indigo-500" },
    { label: "Paid", at: ro.paidAt, color: "bg-green-500" },
  ];
  if (ro.cancelledAt)
    events.push({
      label: "Cancelled",
      at: ro.cancelledAt,
      color: "bg-red-500",
    });

  return (
    <ol className="p-4 space-y-3 text-sm">
      {events.map((e, idx) => (
        <li key={idx} className="flex items-center gap-3">
          <span
            className={`h-2 w-2 rounded-full ${e.at ? e.color : "bg-zinc-200"}`}
            aria-hidden
          />
          <span
            className={e.at ? "text-zinc-900" : "text-zinc-400"}
          >
            {e.label}
          </span>
          <span className="ml-auto text-xs text-zinc-500 tabular-nums">
            {e.at ? <LocalDateTime value={e.at} /> : "—"}
          </span>
        </li>
      ))}
    </ol>
  );
}
