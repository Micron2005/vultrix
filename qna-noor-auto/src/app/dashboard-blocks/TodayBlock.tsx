import { Today } from "@/app/goals/Today";
import { getCurrentUser } from "@/lib/session";

export async function TodayBlock({
  orgId,
  timezone,
  hasInvoices,
  title,
}: {
  orgId: string;
  timezone: string;
  hasInvoices: boolean;
  title?: string;
}) {
  const user = await getCurrentUser();
  return (
    <Today
      orgId={orgId}
      timezone={timezone}
      hasInvoices={hasInvoices}
      title={title}
      forUserId={user?.role === "STAFF" ? user.id : undefined}
    />
  );
}
