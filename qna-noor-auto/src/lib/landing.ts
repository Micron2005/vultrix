import { db } from "@/lib/db";
import {
  DEFAULT_LANDING_CONFIG,
  normalizeLandingConfig,
  type LandingConfig,
} from "@/lib/landingConfig";

const SINGLETON_ID = "singleton";

export async function getLandingConfig(): Promise<LandingConfig> {
  try {
    const row = await db.landingContent.findUnique({
      where: { id: SINGLETON_ID },
      select: { config: true },
    });
    if (!row?.config) return DEFAULT_LANDING_CONFIG;
    return normalizeLandingConfig(JSON.parse(row.config));
  } catch {
    return DEFAULT_LANDING_CONFIG;
  }
}

export async function saveLandingConfig(cfg: LandingConfig): Promise<void> {
  await db.landingContent.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, config: JSON.stringify(cfg) },
    update: { config: JSON.stringify(cfg) },
  });
}
