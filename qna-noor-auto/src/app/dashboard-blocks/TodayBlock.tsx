import { Today } from "@/app/goals/Today";

export async function TodayBlock({
  orgId,
  timezone,
  hasInvoices,
}: {
  orgId: string;
  timezone: string;
  hasInvoices: boolean;
}) {
  return <Today orgId={orgId} timezone={timezone} hasInvoices={hasInvoices} />;
}
