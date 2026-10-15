import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { db } from "@/lib/db";
import { findPeople } from "@/lib/people";
import { requireUser } from "@/lib/session";
import { follow, removeFollower, saveProfile } from "./actions";

type SearchParams = Record<string, string | string[] | undefined>;

type ProfileLinkItem = {
  id: string;
  handle: string;
  displayName: string;
  headline: string | null;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function ProfileForm({
  displayName,
  profile,
}: {
  displayName: string;
  profile: {
    displayName: string;
    handle: string;
    headline: string | null;
    bio: string | null;
    discoverable: boolean;
  } | null;
}) {
  return (
    <form action={saveProfile} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name">
          <Input
            name="displayName"
            defaultValue={profile?.displayName ?? displayName}
            maxLength={60}
            required
          />
        </Field>
        <Field label="@username" hint="3–30 letters, numbers, or underscores.">
          <Input
            name="handle"
            defaultValue={profile?.handle ?? ""}
            placeholder="yourname"
            maxLength={30}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </Field>
      </div>
      <Field label="What you do">
        <Input
          name="headline"
          defaultValue={profile?.headline ?? ""}
          maxLength={80}
          placeholder="Musician, owner, or something else"
        />
      </Field>
      <Field label="Bio">
        <Textarea
          name="bio"
          defaultValue={profile?.bio ?? ""}
          maxLength={500}
          rows={4}
          placeholder="A little about you"
        />
      </Field>
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="discoverable"
          defaultChecked={profile?.discoverable ?? false}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-[var(--vx-accent-600)]"
        />
        <span>Let people find me by my name or @username</span>
      </label>
      <Button type="submit">
        {profile ? "Save profile" : "Create profile"}
      </Button>
    </form>
  );
}

function ProfileRow({
  profile,
  action,
}: {
  profile: ProfileLinkItem;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <Link
        href={`/people/${profile.handle}`}
        className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vx-accent-600)]"
      >
        <p className="truncate text-sm font-medium text-zinc-900">
          {profile.displayName}
        </p>
        <p className="truncate text-xs text-zinc-500">@{profile.handle}</p>
        {profile.headline && (
          <p className="mt-1 truncate text-xs text-zinc-600">
            {profile.headline}
          </p>
        )}
      </Link>
      {action}
    </div>
  );
}

const profileErrors: Record<string, string> = {
  bio_too_long: "Bio must be 500 characters or fewer.",
  display_name: "Display name is required and must be 60 characters or fewer.",
  handle_invalid: "Use 3–30 letters, numbers, or underscores for your @username.",
  handle_taken: "That @username is already taken. Choose another one.",
  headline_too_long: "What you do must be 80 characters or fewer.",
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (!user.orgId) redirect("/admin");

  const params = await searchParams;
  const query = firstValue(params.q).trim();
  const profile = await db.profile.findUnique({
    where: { orgId: user.orgId },
    select: {
      id: true,
      handle: true,
      displayName: true,
      headline: true,
      bio: true,
      discoverable: true,
    },
  });
  const canManage = user.role === "OWNER" || user.role === "ADMIN";
  const [results, followingRows, followerRows] = await Promise.all([
    query ? findPeople(query, profile?.id ?? null) : Promise.resolve([]),
    profile
      ? db.follow.findMany({
          where: { followerId: profile.id },
          orderBy: { createdAt: "desc" },
          select: {
            following: {
              select: { id: true, handle: true, displayName: true, headline: true },
            },
          },
        })
      : Promise.resolve([]),
    profile
      ? db.follow.findMany({
          where: { followingId: profile.id },
          orderBy: { createdAt: "desc" },
          select: {
            follower: {
              select: { id: true, handle: true, displayName: true, headline: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const followingIds = new Set(followingRows.map((row) => row.following.id));
  const followerIds = new Set(followerRows.map((row) => row.follower.id));
  const connected = followingRows.filter((row) =>
    followerIds.has(row.following.id),
  );
  const editProfile =
    canManage && (!profile || firstValue(params.edit) === "1");
  const error = profileErrors[firstValue(params.error)];

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Find someone by their exact name or @username."
      />

      {firstValue(params.need_profile) === "1" && (
        <p
          role="status"
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
        >
          Create your profile first so they can see who followed them.
        </p>
      )}
      {firstValue(params.saved) === "1" && (
        <p
          role="status"
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
        >
          Profile saved.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
        >
          {error}
        </p>
      )}

      <Card>
        <CardHeader
          title="Your profile"
          description={
            !profile || profile.discoverable
              ? "Only people who type your exact name or @username can find you."
              : "Your profile is hidden from search, but existing followers can still view it."
          }
          actions={
            profile && canManage && !editProfile ? (
              <LinkButton
                href="/people?edit=1"
                variant="secondary"
                size="sm"
              >
                Edit
              </LinkButton>
            ) : undefined
          }
        />
        <CardBody>
          {editProfile ? (
            <ProfileForm
              displayName={user.orgName ?? ""}
              profile={profile}
            />
          ) : profile ? (
            <div className="space-y-2">
              <p className="text-base font-semibold text-zinc-900">
                {profile.displayName}
              </p>
              <p className="text-sm text-zinc-500">@{profile.handle}</p>
              {profile.headline && (
                <p className="text-sm text-zinc-700">{profile.headline}</p>
              )}
              {profile.bio && (
                <p className="whitespace-pre-wrap text-sm text-zinc-600">
                  {profile.bio}
                </p>
              )}
              <Badge tone={profile.discoverable ? "success" : "neutral"}>
                {profile.discoverable ? "Discoverable" : "Not discoverable"}
              </Badge>
              {!canManage && (
                <p className="pt-1 text-xs text-zinc-500">
                  An owner or admin can edit this profile.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {canManage ? (
                <ProfileForm displayName={user.orgName ?? ""} profile={null} />
              ) : (
                <p className="text-sm text-zinc-500">
                  An owner or admin can create this account profile.
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Find someone" />
        <CardBody>
          <form method="get" className="flex flex-col gap-2 sm:flex-row">
            <Input
              name="q"
              defaultValue={query}
              placeholder="Exact name or @username"
              aria-label="Exact name or @username"
              className="min-h-11 flex-1"
            />
            <Button type="submit" className="min-h-11">
              Search
            </Button>
          </form>
          {query && (
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <h2 className="mb-2 text-sm font-semibold text-zinc-900">
                Search results
              </h2>
              {results.length ? (
                <div className="divide-y divide-zinc-100">
                  {results.map((result) => (
                    <ProfileRow key={result.id} profile={result} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">
                  No one found. Check the spelling — search only matches an
                  exact name or @username.
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {profile && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader title="Connected" />
            <CardBody>
              {connected.length ? (
                <div className="divide-y divide-zinc-100">
                  {connected.map((row) => (
                    <ProfileRow key={row.following.id} profile={row.following} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No connections yet.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Following" />
            <CardBody>
              {followingRows.length ? (
                <div className="divide-y divide-zinc-100">
                  {followingRows.map((row) => (
                    <ProfileRow key={row.following.id} profile={row.following} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Not following anyone yet.</p>
              )}
            </CardBody>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader title="Followers" />
            <CardBody>
              {followerRows.length ? (
                <div className="divide-y divide-zinc-100">
                  {followerRows.map((row) => (
                    <ProfileRow
                      key={row.follower.id}
                      profile={row.follower}
                      action={
                        canManage ? (
                          <div className="flex shrink-0 gap-2">
                            {!followingIds.has(row.follower.id) && (
                              <form action={follow.bind(null, row.follower.id)}>
                                <Button type="submit" size="xs">
                                  Follow back
                                </Button>
                              </form>
                            )}
                            <form
                              action={removeFollower.bind(
                                null,
                                row.follower.id,
                              )}
                            >
                              <Button type="submit" size="xs" variant="danger">
                                Remove
                              </Button>
                            </form>
                          </div>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No followers yet.</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
