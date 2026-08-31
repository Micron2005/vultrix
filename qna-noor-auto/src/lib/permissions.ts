import { redirect } from "next/navigation";
import { requireUser, type Role } from "@/lib/session";

const STAFF_PERMISSION_ERROR = "You don't have permission to do that";

export function canDelete(role: Role): boolean {
  return role !== "STAFF";
}

export function canManagePayments(role: Role): boolean {
  return role !== "STAFF";
}

export function canViewFinancials(role: Role): boolean {
  return role !== "STAFF";
}

export function canManageSettings(role: Role): boolean {
  return role !== "STAFF";
}

export async function requireFinancialAccess() {
  const user = await requireUser();
  if (!canViewFinancials(user.role)) redirect("/");
  return user;
}

export async function requireSettingsAccess() {
  const user = await requireUser();
  if (!canManageSettings(user.role)) redirect("/");
  return user;
}

export function assertCanDelete(role: Role): void {
  if (!canDelete(role)) throw new Error(STAFF_PERMISSION_ERROR);
}

export function assertCanManagePayments(role: Role): void {
  if (!canManagePayments(role)) throw new Error(STAFF_PERMISSION_ERROR);
}

export function assertCanViewFinancials(role: Role): void {
  if (!canViewFinancials(role)) throw new Error(STAFF_PERMISSION_ERROR);
}

export function assertCanManageSettings(role: Role): void {
  if (!canManageSettings(role)) throw new Error(STAFF_PERMISSION_ERROR);
}
