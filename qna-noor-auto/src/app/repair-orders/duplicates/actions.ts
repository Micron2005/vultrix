"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";

/**
 * Delete an RO from the duplicates review page and stay on that page.
 * The main deleteRepairOrder redirects to /repair-orders — we want to
 * keep reviewing duplicates after each delete.
 */
export async function deleteFromDuplicates(id: string, fd: FormData) {
  const orgId = await requireOrgId();
  // Require the "DELETE" confirmation string so a stray click can't
  // destroy work.
  const confirm = String(fd.get("confirm") ?? "").trim();
  if (confirm !== "DELETE") {
    redirect("/repair-orders/duplicates?error=confirm_required");
  }

  const ro = await db.repairOrder.findFirst({ where: { id, orgId } });
  if (!ro) {
    redirect("/repair-orders/duplicates?error=not_found");
  }

  // PAID ROs are closed books — they only appear here for reference. Guard the
  // server action itself (the UI hides the delete form, but server actions can
  // be invoked directly) so a paid ticket's financial records can't be wiped.
  if (ro.status === "PAID") {
    redirect("/repair-orders/duplicates?error=paid_locked");
  }

  // Soft delete: move to Trash (recoverable) instead of destroying the ticket.
  await db.repairOrder.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/repair-orders");
  revalidatePath("/repair-orders/trash");
  revalidatePath("/repair-orders/duplicates");
  revalidatePath("/");
  revalidatePath(`/customers/${ro.customerId}`);
  revalidatePath(`/vehicles/${ro.vehicleId}`);
  redirect("/repair-orders/duplicates?deleted=1");
}
