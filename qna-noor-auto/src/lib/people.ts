const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

export function normalizeHandle(raw: string): string | null {
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  return HANDLE_PATTERN.test(handle) ? handle : null;
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function findPeople(
  query: string,
  viewerProfileId: string | null,
) {
  const trimmed = query.trim();
  const displayNameLower = normalizeName(trimmed);
  if (displayNameLower.length < 2) return [];

  const normalizedHandle = normalizeHandle(trimmed);
  const handleQuery = trimmed.startsWith("@") || normalizedHandle !== null;
  const matches = [
    { displayNameLower },
    ...(handleQuery && normalizedHandle ? [{ handle: normalizedHandle }] : []),
  ];
  const { db } = await import("./db");

  return db.profile.findMany({
    where: {
      discoverable: true,
      ...(viewerProfileId ? { id: { not: viewerProfileId } } : {}),
      OR: matches,
    },
    select: {
      id: true,
      handle: true,
      displayName: true,
      headline: true,
    },
    orderBy: [{ displayNameLower: "asc" }, { handle: "asc" }],
    take: 10,
  });
}

export async function relationship(
  viewerProfileId: string,
  otherProfileId: string,
): Promise<{ following: boolean; followsYou: boolean; connected: boolean }> {
  if (viewerProfileId === otherProfileId) {
    return { following: false, followsYou: false, connected: false };
  }

  const { db } = await import("./db");
  const [following, followsYou] = await Promise.all([
    db.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerProfileId,
          followingId: otherProfileId,
        },
      },
      select: { id: true },
    }),
    db.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: otherProfileId,
          followingId: viewerProfileId,
        },
      },
      select: { id: true },
    }),
  ]);

  return {
    following: Boolean(following),
    followsYou: Boolean(followsYou),
    connected: Boolean(following && followsYou),
  };
}
