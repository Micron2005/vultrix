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

type ProfileFormValues = {
  displayName: string;
  handle: string;
  headline: string;
  bio: string;
  discoverable: boolean;
};

type NetworkTab = "connected" | "following" | "followers";

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function ProfileForm({
  displayName,
  profile,
  values,
}: {
  displayName: string;
  profile: {
    displayName: string;
    handle: string;
    headline: string | null;
    bio: string | null;
    discoverable: boolean;
  } | null;
  values?: ProfileFormValues;
}) {
  const defaultValues = values ?? {
    displayName: profile?.displayName ?? displayName,
    handle: profile?.handle ?? "",
    headline: profile?.headline ?? "",
    bio: profile?.bio ?? "",
    discoverable: profile?.discoverable ?? false,
  };

  return (
    <form action={saveProfile} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name">
          <Input
            name="displayName"
            defaultValue={defaultValues.displayName}
            maxLength={60}
            required
          />
        </Field>
        <Field label="@username" hint="3–30 letters, numbers, or underscores.">
          <Input
            name="handle"
            defaultValue={defaultValues.handle}
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
          defaultValue={defaultValues.headline}
          maxLength={80}
          placeholder="Musician, owner, or something else"
        />
      </Field>
      <Field label="Bio">
        <Textarea
          name="bio"
          defaultValue={defaultValues.bio}
          maxLength={500}
          rows={4}
          placeholder="A little about you"
        />
      </Field>
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="discoverable"
          defaultChecked={defaultValues.discoverable}
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
    <div
      className={`flex gap-3 py-3 first:pt-0 last:pb-0 ${
        action
          ? "flex-col items-stretch sm:flex-row sm:items-center sm:justify-between"
          : "items-center justify-between"
      }`}
    >
      <Link
        href={`/people/${profile.handle}`}
        className={`min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vx-accent-600)] ${
          action ? "w-full sm:w-auto" : ""
        }`}
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
      {action && (
        <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
          {action}
        </div>
      )}
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
  const requestedTab = firstValue(params.tab);
  const defaultTab =
    connected.length === 0 && followerRows.length > 0
      ? "followers"
      : "connected";
  const activeTab: NetworkTab =
    requestedTab === "connected" ||
    requestedTab === "following" ||
    requestedTab === "followers"
      ? requestedTab
      : defaultTab;
  const networkTabs = [
    { id: "connected", label: "Connected", count: connected.length },
    { id: "following", label: "Following", count: followingRows.length },
    { id: "followers", label: "Followers", count: followerRows.length },
  ] as const;
  const editProfile =
    canManage && (!profile || firstValue(params.edit) === "1");
  const hasError = Boolean(firstValue(params.error));
  const error = profileErrors[firstValue(params.error)];
  const formValues: ProfileFormValues | undefined = hasError
    ? {
        displayName: firstValue(params.displayName),
        handle: firstValue(params.handle),
        headline: firstValue(params.headline),
        bio: firstValue(params.bio).slice(0, 500),
        discoverable: firstValue(params.discoverable) === "on",
      }
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Find someone by their exact name or @username."
      />

      <Card>
        <CardHeader title="Your network" />
        <CardBody>
          <nav
            aria-label="Your network"
            className="mb-4 grid grid-cols-3 gap-2"
          >
            {networkTabs.map((tab) => (
              <Link
                key={tab.id}
                href={`/people?tab=${tab.id}`}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`flex min-h-11 items-center justify-between gap-1 rounded-md border px-2 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vx-accent-600)] sm:px-3 ${
                  activeTab === tab.id
                    ? "border-[var(--vx-accent-600)] bg-zinc-100 text-zinc-900"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                <span>{tab.label}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {tab.count}
                </span>
              </Link>
            ))}
          </nav>

          {!profile ? (
            <p className="text-sm text-zinc-600">
              Create your profile below to follow people and see who follows you.
            </p>
          ) : activeTab === "connected" ? (
            connected.length ? (
              <div className="divide-y divide-zinc-100">
                {connected.map((row) => (
                  <ProfileRow key={row.following.id} profile={row.following} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No connections yet.</p>
            )
          ) : activeTab === "following" ? (
            followingRows.length ? (
              <div className="divide-y divide-zinc-100">
                {followingRows.map((row) => (
                  <ProfileRow key={row.following.id} profile={row.following} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Not following anyone yet.</p>
            )
          ) : followerRows.length ? (
            <div className="divide-y divide-zinc-100">
              {followerRows.map((row) => (
                <ProfileRow
                  key={row.follower.id}
                  profile={row.follower}
                  action={
                    canManage ? (
                      <>
                        {!followingIds.has(row.follower.id) && (
                          <form action={follow.bind(null, row.follower.id)}>
                            <Button type="submit" size="xs">
                              Follow back
                            </Button>
                          </form>
                        )}
                        <form
                          action={removeFollower.bind(null, row.follower.id)}
                        >
                          <Button type="submit" size="xs" variant="danger">
                            Remove
                          </Button>
                        </form>
                      </>
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
              values={formValues}
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

    </div>
  );
}
