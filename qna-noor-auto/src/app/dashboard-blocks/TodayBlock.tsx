import { Today } from "@/app/goals/Today";

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
  return (
    <Today
      orgId={orgId}
      timezone={timezone}
      hasInvoices={hasInvoices}
      title={title}
    />
  );
}
