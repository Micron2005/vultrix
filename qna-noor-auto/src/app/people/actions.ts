"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { normalizeHandle, normalizeName } from "@/lib/people";
import { notify } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

async function requirePeopleManager(): Promise<string> {
  const user = await requireUser();
  if (
    !user.orgId ||
    (user.role !== "OWNER" && user.role !== "ADMIN")
  ) {
    redirect("/people");
  }
  return user.orgId;
}

function revalidatePeoplePaths(
  ...handles: Array<string | null | undefined>
): void {
  revalidatePath("/people");
  for (const handle of new Set(handles.filter((value): value is string => Boolean(value)))) {
    revalidatePath(`/people/${handle}`);
  }
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function saveProfile(formData: FormData): Promise<void> {
  const orgId = await requirePeopleManager();
  const value = (name: string) => String(formData.get(name) ?? "");
  const displayName = value("displayName").trim().replace(/\s+/g, " ");
  const handle = normalizeHandle(value("handle"));
  const headline = value("headline").trim();
  const bio = value("bio").trim();

  if (!displayName || displayName.length > 60) {
    redirect("/people?edit=1&error=display_name");
  }
  if (!handle) redirect("/people?edit=1&error=handle_invalid");
  if (headline.length > 80) redirect("/people?edit=1&error=headline_too_long");
  if (bio.length > 500) redirect("/people?edit=1&error=bio_too_long");

  const previous = await db.profile.findUnique({
    where: { orgId },
    select: { handle: true },
  });
  const existingHandle = await db.profile.findUnique({
    where: { handle },
    select: { orgId: true },
  });
  if (existingHandle && existingHandle.orgId !== orgId) {
    redirect("/people?edit=1&error=handle_taken");
  }

  try {
    await db.profile.upsert({
      where: { orgId },
      create: {
        orgId,
        handle,
        displayName,
        displayNameLower: normalizeName(displayName),
        headline: headline || null,
        bio: bio || null,
        discoverable: formData.get("discoverable") === "on",
      },
      update: {
        handle,
        displayName,
        displayNameLower: normalizeName(displayName),
        headline: headline || null,
        bio: bio || null,
        discoverable: formData.get("discoverable") === "on",
      },
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      redirect("/people?edit=1&error=handle_taken");
    }
    throw error;
  }

  revalidatePeoplePaths(previous?.handle, handle);
  redirect("/people?saved=1");
}

export async function follow(profileId: string): Promise<void> {
  const orgId = await requirePeopleManager();
  const viewer = await db.profile.findUnique({
    where: { orgId },
    select: { id: true, handle: true, displayName: true },
  });
  if (!viewer) redirect("/people?need_profile=1");

  const target = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      orgId: true,
      handle: true,
      discoverable: true,
    },
  });
  if (!target || target.id === viewer.id) return;

  const followsYou = await db.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: target.id,
        followingId: viewer.id,
      },
    },
    select: { id: true },
  });
  if (!target.discoverable && !followsYou) return;

  const created = await db.follow.createMany({
    data: { followerId: viewer.id, followingId: target.id },
    skipDuplicates: true,
  });
  if (created.count > 0) {
    await notify({
      orgId: target.orgId,
      kind: "new_follower",
      title: followsYou
        ? `${viewer.displayName} followed you back — you're connected`
        : `${viewer.displayName} (@${viewer.handle}) followed you`,
      href: `/people/${viewer.handle}`,
    });
  }

  revalidatePeoplePaths(viewer.handle, target.handle);
}

export async function unfollow(profileId: string): Promise<void> {
  const orgId = await requirePeopleManager();
  const viewer = await db.profile.findUnique({
    where: { orgId },
    select: { id: true, handle: true },
  });
  if (!viewer || viewer.id === profileId) return;

  const target = await db.profile.findUnique({
    where: { id: profileId },
    select: { handle: true },
  });
  if (!target) return;

  await db.follow.deleteMany({
    where: { followerId: viewer.id, followingId: profileId },
  });
  revalidatePeoplePaths(viewer.handle, target.handle);
}

export async function removeFollower(profileId: string): Promise<void> {
  const orgId = await requirePeopleManager();
  const viewer = await db.profile.findUnique({
    where: { orgId },
    select: { id: true, handle: true },
  });
  if (!viewer || viewer.id === profileId) return;

  const follower = await db.profile.findUnique({
    where: { id: profileId },
    select: { handle: true },
  });
  if (!follower) return;

  await db.follow.deleteMany({
    where: { followerId: profileId, followingId: viewer.id },
  });
  revalidatePeoplePaths(viewer.handle, follower.handle);
}
