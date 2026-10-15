export const MUSIC_ADDON_PRICE_USD = Number(
  process.env.MUSIC_ADDON_PRICE_USD ?? 10,
);

export const MUSIC_ADDON_LOOKUP_KEY_PREFIX = "vultrix_music_addon_";

export type MusicAccess = {
  allowed: boolean;
  reason: "free_account" | "addon" | "grace" | "none";
  graceUntil: Date | null;
};

export function musicAccess(
  org: {
    billingExempt: boolean;
    musicAddon: boolean;
    musicAddonGraceUntil: Date | null;
  },
  now = new Date(),
): MusicAccess {
  const graceUntil = org.musicAddonGraceUntil;
  if (org.billingExempt) {
    return { allowed: true, reason: "free_account", graceUntil };
  }
  if (org.musicAddon) {
    return { allowed: true, reason: "addon", graceUntil };
  }
  if (graceUntil && graceUntil > now) {
    return { allowed: true, reason: "grace", graceUntil };
  }
  return { allowed: false, reason: "none", graceUntil };
}

export function musicAddonLookupKey(): string {
  return `${MUSIC_ADDON_LOOKUP_KEY_PREFIX}${MUSIC_ADDON_PRICE_USD}`;
}

export function isMusicAddonItem(item: {
  price: { lookup_key?: string | null };
}): boolean {
  return Boolean(
    item.price.lookup_key?.startsWith(MUSIC_ADDON_LOOKUP_KEY_PREFIX),
  );
}

export function pickBaseSubscriptionItem<
  T extends { price: { lookup_key?: string | null } },
>(items: readonly T[]): T | undefined {
  return items.find((item) => !isMusicAddonItem(item));
}
