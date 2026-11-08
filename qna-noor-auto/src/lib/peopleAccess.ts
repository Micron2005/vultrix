import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";

export async function requirePeopleManager(): Promise<string> {
  const user = await requireUser();
  if (!user.orgId || (user.role !== "OWNER" && user.role !== "ADMIN")) {
    redirect("/people");
  }
  return user.orgId;
}
