import { db } from "@/lib/db";

export const ACTIVITY_LABELS: Record<string, string> = {
  "repair_order.create": "Repair order created",
  "repair_order.status_change": "Repair order status changed",
  "repair_order.delete": "Repair order deleted",
  "repair_order.restore": "Repair order restored",
  "repair_order.purge": "Repair order permanently deleted",
  "repair_order.undo_paid": "Repair order marked unpaid",
  "repair_order.clear": "Repair order cleared",
  "repair_order.revert_invoice": "Invoice reverted to repair order",
  "repair_order.bulk_delete": "Repair orders deleted",
  "repair_order.bulk_clear": "Repair orders cleared",
  "payment.create": "Payment recorded",
  "payment.delete": "Payment deleted",
  "payment.bulk_create": "Bulk payment recorded",
  "payment.bulk_selected": "Selected tickets paid",
  "payment.bulk_remove": "Duplicate payments removed",
  "customer.create": "Customer created",
  "customer.delete": "Customer deleted",
  "expense.create": "Expense recorded",
  "expense.update": "Expense updated",
  "expense.delete": "Expense deleted",
  "income.create": "Income recorded",
  "income.update": "Income updated",
  "income.delete": "Income deleted",
  "inventory.part_create": "Inventory part created",
  "inventory.part_delete": "Inventory part deleted",
  "inventory.stock_adjust": "Stock adjusted",
  "inventory.scan_adjust": "Stock adjusted by quick scan",
  "inventory.scan_undo": "Stock adjustment undone",
  "vehicle.create": "Vehicle created",
  "vehicle.delete": "Vehicle deleted",
  "technician.create": "Technician created",
  "technician.delete": "Technician deleted",
  "user.create": "Login created",
  "user.activate": "Login reactivated",
  "user.deactivate": "Login deactivated",
  "user.password_reset": "Password reset",
  "user.delete": "Login deleted",
};

export function activityLabel(action: string): string {
  const knownLabel = ACTIVITY_LABELS[action];
  if (knownLabel) return knownLabel;
  const humanized = action.replace(/[._]+/g, " ").trim();
  return humanized
    ? humanized.charAt(0).toUpperCase() + humanized.slice(1)
    : "Unknown action";
}

export async function logActivity(input: {
  orgId: string | null;
  user: { id: string; username: string } | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
}): Promise<void> {
  if (!input.orgId) return;
  try {
    await db.activityLog.create({
      data: {
        orgId: input.orgId,
        userId: input.user?.id ?? null,
        username: input.user?.username ?? "system",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
      },
    });
  } catch (error) {
    console.error("Failed to write activity log:", error);
  }
}
