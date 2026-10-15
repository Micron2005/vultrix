import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, Button, Card, CardBody, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { normalizeHandle, relationship } from "@/lib/people";
import { requireUser } from "@/lib/session";
import { follow, unfollow } from "../actions";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");

  const { handle: rawHandle } = await params;
  const handle = normalizeHandle(rawHandle);
  if (!handle) notFound();

  const profile = await db.profile.findUnique({
    where: { handle },
    select: {
      id: true,
      handle: true,
      displayName: true,
      headline: true,
      bio: true,
      discoverable: true,
    },
  });
  if (!profile) notFound();

  const viewer = await db.profile.findUnique({
    where: { orgId: user.orgId },
    select: { id: true },
  });
  if (viewer?.id === profile.id) redirect("/people");

  const relation = viewer
    ? await relationship(viewer.id, profile.id)
    : { following: false, followsYou: false, connected: false };
  if (
    !profile.discoverable &&
    !relation.following &&
    !relation.followsYou
  ) {
    notFound();
  }

  const canManage = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.displayName}
        description={`@${profile.handle}`}
        actions={
          <Link
            href="/people"
            className="text-sm font-medium text-[var(--vx-accent-600)] hover:underline"
          >
            Back to People
          </Link>
        }
      />
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {relation.followsYou && <Badge>Follows you</Badge>}
            {relation.connected && <Badge tone="success">Connected</Badge>}
          </div>
          {profile.headline && (
            <p className="text-base font-medium text-zinc-800">
              {profile.headline}
            </p>
          )}
          {profile.bio && (
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-600">
              {profile.bio}
            </p>
          )}
          {canManage && (
            <div className="border-t border-zinc-200 pt-4">
              {relation.following ? (
                <form action={unfollow.bind(null, profile.id)}>
                  <Button type="submit" variant="secondary">
                    Unfollow
                  </Button>
                </form>
              ) : (
                <form action={follow.bind(null, profile.id)}>
                  <Button type="submit">Follow</Button>
                </form>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
