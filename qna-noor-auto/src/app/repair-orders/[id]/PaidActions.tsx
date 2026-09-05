"use client";

import { useTransition } from "react";
import { clearRepairOrder, undoPaid } from "../actions";

/**
 * Action buttons shown on a PAID repair order. While a ticket is only paid
 * (not yet cleared) you can Undo Paid or Clear it. Once it is cleared the
 * ticket is final — no actions are offered, so it can't be uncleared or
 * unpaid.
 */
export function PaidActions({
  id,
  cleared,
}: {
  id: string;
  cleared: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  // Cleared tickets are locked: no undo, no unclear.
  if (cleared) return null;

  function handleUndo() {
    if (
      !window.confirm(
        "Undo Paid? This marks the ticket as unpaid (the full balance will be owed again) and removes any recorded payments on it.",
      )
    ) {
      return;
    }
    startTransition(() => undoPaid(id));
  }

  return (
    <>
      <button
        type="button"
        onClick={handleUndo}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
      >
        Undo Paid
      </button>
      <button
        type="button"
        onClick={() => startTransition(() => clearRepairOrder(id))}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md font-medium h-9 px-4 text-sm bg-[var(--vx-accent-600)] text-[var(--vx-accent-fg)] hover:bg-[var(--vx-accent-700)] disabled:opacity-50"
      >
        Clear Ticket
      </button>
    </>
  );
}
