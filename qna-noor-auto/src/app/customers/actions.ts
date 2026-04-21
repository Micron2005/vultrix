"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

const CustomerSchema = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]).default("INDIVIDUAL"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  altPhone: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function cleanEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

function parseFormData(fd: FormData) {
  const obj = Object.fromEntries(fd.entries());
  return CustomerSchema.parse(cleanEmpty(obj));
}

export async function createCustomer(fd: FormData) {
  const data = parseFormData(fd);
  const created = await db.customer.create({ data });
  revalidatePath("/customers");
  revalidatePath("/");
  redirect(`/customers/${created.id}`);
}

export async function updateCustomer(id: string, fd: FormData) {
  const data = parseFormData(fd);
  await db.customer.update({ where: { id }, data });
  revalidatePath(`/customers/${id}`);
  revalidatePath("/customers");
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(id: string) {
  await db.customer.delete({ where: { id } });
  revalidatePath("/customers");
  revalidatePath("/");
  redirect("/customers");
}
