import { redirect } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { db } from "@/lib/db";
import { listMemories } from "@/lib/assistant/memory";
import { requireUser } from "@/lib/session";
import { createMemory, forgetEverything } from "./actions";
import { ForgetEverythingForm } from "./ForgetEverythingForm";
import { MemoryList } from "./MemoryList";

export const dynamic = "force-dynamic";

export default async function AssistantMemoryPage() {
  const user = await requireUser();
  if (!user.orgId) redirect("/");
  const org = await db.organization.findUnique({
    where: { id: user.orgId },
    select: { aiAssistantEnabled: true, aiAssistantName: true },
  });
  if (!org?.aiAssistantEnabled) redirect("/");
  const memories = await listMemories(user.orgId, user.id);
  return (
    <>
      <PageHeader
        title="Memory"
        description={`Facts and preferences ${org.aiAssistantName} has saved. Only you can see these.`}
        actions={<LinkButton href="/assistant" variant="secondary">Back to assistant</LinkButton>}
      />
      <Card className="max-w-3xl">
        <CardHeader
          title="Add a memory"
          description="Save a fact or preference for future chats. Never add passwords, keys, or card numbers."
        />
        <CardBody>
          <form action={createMemory} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <Input name="content" maxLength={400} placeholder="e.g. I prefer concise answers" required />
            <Select name="category" defaultValue="fact">
              <option value="preference">Preference</option>
              <option value="fact">Fact</option>
              <option value="project">Project</option>
              <option value="other">Other</option>
            </Select>
            <Button type="submit">Remember</Button>
          </form>
        </CardBody>
      </Card>
      <section className="mt-6 max-w-3xl">
        {memories.length === 0 ? (
          <EmptyState
            title="No memories yet"
            description="When you save a fact or preference, it will appear here."
          />
        ) : (
          <MemoryList memories={memories} />
        )}
      </section>
      {memories.length > 0 && (
        <Card className="mt-8 max-w-3xl border-red-200">
          <CardHeader
            title="Forget everything"
            description="Remove every saved memory for this login."
          />
          <ForgetEverythingForm action={forgetEverything} />
        </Card>
      )}
    </>
  );
}
