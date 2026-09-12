import { redirect } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireOrgId } from "@/lib/session";
import { AssistantClient } from "./AssistantClient";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const orgId = await requireOrgId();
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      aiAssistantEnabled: true,
      aiAssistantName: true,
      aiAssistantVoice: true,
    },
  });
  if (
    !org ||
    !org.aiAssistantEnabled
  ) {
    redirect("/");
  }

  return (
    <>
      <PageHeader
        title={org.aiAssistantName}
        description="Talk to your assistant or type a request."
      />
      <Card className="max-w-3xl">
        <AssistantClient
          assistantName={org.aiAssistantName}
          voiceIdentifier={org.aiAssistantVoice}
        />
      </Card>
    </>
  );
}
