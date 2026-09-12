import { db } from "@/lib/db";
import type { IntelSpec } from "@/lib/vehicleIntel";

export type VehicleLinkPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "other";

export type DetectedVehicleLink = {
  platform: VehicleLinkPlatform;
  embedUrl: string | null;
  thumbnailUrl: string | null;
};

export type VehicleLinkItem = {
  id: string;
  url: string;
  platform: VehicleLinkPlatform;
  title: string;
  notes: string | null;
  yearMin: number | null;
  yearMax: number | null;
  make: string | null;
  model: string | null;
  engine: string | null;
  thumbnailUrl: string | null;
  shared: boolean;
  createdAt: string;
  community: boolean;
  embedUrl: string | null;
};

function youtubeVideoId(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    return url.pathname.slice(1).split("/")[0] || null;
  }
  if (host !== "youtube.com" && host !== "m.youtube.com") return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const match = url.pathname.match(/^\/shorts\/([^/]+)/);
  return match?.[1] ?? null;
}

function cleanVideoId(value: string | null) {
  return value && /^[A-Za-z0-9_-]{6,}$/.test(value) ? value : null;
}

async function fetchTikTokThumbnail(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { thumbnail_url?: unknown };
    return typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function detectPlatform(
  rawUrl: string,
): Promise<DetectedVehicleLink> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) links are supported.");
  }

  const youtubeId = cleanVideoId(youtubeVideoId(url));
  if (youtubeId) {
    return {
      platform: "youtube",
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const tiktokMatch =
    host === "tiktok.com" &&
    url.pathname.match(/^\/@[^/]+\/video\/([0-9]+)/i);
  if (tiktokMatch) {
    return {
      platform: "tiktok",
      embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`,
      thumbnailUrl: await fetchTikTokThumbnail(url.toString()),
    };
  }

  if (host === "instagram.com") {
    const instagramMatch = url.pathname.match(/^\/(p|reel|reels)\/([^/]+)/i);
    if (instagramMatch) {
      const kind = instagramMatch[1].toLowerCase() === "p" ? "p" : "reel";
      return {
        platform: "instagram",
        embedUrl: `https://www.instagram.com/${kind}/${instagramMatch[2]}/embed`,
        thumbnailUrl: null,
      };
    }
  }

  return {
    platform: "other",
    embedUrl: null,
    thumbnailUrl: null,
  };
}

function storedEmbedUrl(platform: VehicleLinkPlatform, url: string) {
  try {
    if (platform === "youtube") {
      const id = cleanVideoId(youtubeVideoId(new URL(url)));
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (platform === "tiktok") {
      const match = new URL(url).pathname.match(/^\/@[^/]+\/video\/([0-9]+)/i);
      return match ? `https://www.tiktok.com/embed/v2/${match[1]}` : null;
    }
    if (platform === "instagram") {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/^\/(p|reel|reels)\/([^/]+)/i);
      if (!match) return null;
      const kind = match[1].toLowerCase() === "p" ? "p" : "reel";
      return `https://www.instagram.com/${kind}/${match[2]}/embed`;
    }
  } catch {
    return null;
  }
  return null;
}

function matchingTarget(spec: IntelSpec) {
  return {
    AND: [
      {
        OR: [
          { make: null },
          { make: { equals: spec.make, mode: "insensitive" as const } },
        ],
      },
      {
        OR: [
          { model: null },
          { model: { equals: spec.model, mode: "insensitive" as const } },
        ],
      },
      { OR: [{ yearMin: null }, { yearMin: { lte: spec.year } }] },
      { OR: [{ yearMax: null }, { yearMax: { gte: spec.year } }] },
    ],
  };
}

function mapLink(
  link: {
    id: string;
    url: string;
    platform: string;
    title: string;
    notes: string | null;
    yearMin: number | null;
    yearMax: number | null;
    make: string | null;
    model: string | null;
    engine: string | null;
    thumbnailUrl: string | null;
    shared: boolean;
    createdAt: Date;
  },
  community: boolean,
): VehicleLinkItem {
  const platform = (
    ["youtube", "tiktok", "instagram"].includes(link.platform)
      ? link.platform
      : "other"
  ) as VehicleLinkPlatform;
  return {
    id: link.id,
    url: link.url,
    platform,
    title: link.title,
    notes: link.notes,
    yearMin: link.yearMin,
    yearMax: link.yearMax,
    make: link.make,
    model: link.model,
    engine: link.engine,
    thumbnailUrl: link.thumbnailUrl,
    shared: link.shared,
    createdAt: link.createdAt.toISOString(),
    community,
    embedUrl: storedEmbedUrl(platform, link.url),
  };
}

export async function loadVehicleLinks(
  orgId: string,
  spec: IntelSpec,
  options: { community: boolean },
): Promise<VehicleLinkItem[]> {
  if (options.community) {
    const caller = await db.organization.findUnique({
      where: { id: orgId },
      select: { shareFixes: true },
    });
    if (!caller?.shareFixes) return [];

    const links = await db.vehicleLink.findMany({
      where: {
        orgId: { not: orgId },
        shared: true,
        organization: { shareFixes: true, status: "ACTIVE" },
        ...matchingTarget(spec),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return links.map((link) => mapLink(link, true));
  }

  const links = await db.vehicleLink.findMany({
    where: {
      orgId,
      ...matchingTarget(spec),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return links.map((link) => mapLink(link, false));
}
