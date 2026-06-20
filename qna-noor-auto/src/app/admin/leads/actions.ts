"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/session";

// NOTE: a "use server" module may only export async functions, so this list is
// kept local (not exported). The page defines its own copy for the UI.
const LEAD_STATUSES = ["new", "contacted", "won", "lost"] as const;

function back(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/admin/leads${qs ? `?${qs}` : ""}`);
}

/** Move a landing-page lead through the pipeline: new -> contacted -> won/lost. */
export async function updateLeadStatus(formData: FormData) {
  await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) {
    back({ error: "Unknown status." });
  }

  const lead = await db.marketingLead.findUnique({ where: { id } });
  if (!lead) back({ error: "Lead not found." });

  await db.marketingLead.update({ where: { id }, data: { status } });
  revalidatePath("/admin/leads");
  back({ saved: "updated" });
}

/** Permanently remove a lead (e.g. spam). */
export async function deleteLead(formData: FormData) {
  await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  const lead = await db.marketingLead.findUnique({ where: { id } });
  if (!lead) back({ error: "Lead not found." });

  await db.marketingLead.delete({ where: { id } });
  revalidatePath("/admin/leads");
  back({ saved: "deleted" });
}
