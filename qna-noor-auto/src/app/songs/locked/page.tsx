import { redirect } from "next/navigation";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { MUSIC_ADDON_PRICE_USD } from "@/lib/musicAddon";
import { requireUser } from "@/lib/session";

export default async function MusicLockedPage() {
  const user = await requireUser();
  if (!user.orgId || !user.focusPacks.includes("music")) redirect("/");
  if (user.musicAccess.allowed) redirect("/songs");

  const canManageBilling = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <>
      <PageHeader
        title="Music add-on"
        description={`Songs, lyrics, beats and practice tools for $${MUSIC_ADDON_PRICE_USD}/month.`}
      />
      <Card className="max-w-2xl space-y-4 p-5">
        <p className="text-sm text-zinc-700">
          Music access is not active for this account. The add-on is billed with
          your existing subscription.
        </p>
        {canManageBilling ? (
          <LinkButton href="/billing#music">View Music add-on</LinkButton>
        ) : (
          <p className="text-sm text-zinc-600">Ask the account owner.</p>
        )}
      </Card>
    </>
  );
}
