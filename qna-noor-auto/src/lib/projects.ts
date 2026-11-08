export const PROJECT_ORG_MAX = 10;
export const PROJECT_FILE_MAX_BYTES = 2 * 1024 * 1024;
export const PROJECT_CHAT_MAX = 2000;

const PROJECT_FILE_TYPES = new Set(["image/jpeg", "application/pdf"]);

function normalizeTitle(raw: string, maxLength: number): string | null {
  const title = raw.trim().replace(/\s+/g, " ");
  const length = Array.from(title).length;
  return length > 0 && length <= maxLength ? title : null;
}

export function normalizeProjectTitle(raw: string): string | null {
  return normalizeTitle(raw, 120);
}

export function normalizeTaskTitle(raw: string): string | null {
  return normalizeTitle(raw, 200);
}

export function normalizeProjectPost(raw: string): string | null {
  const body = raw.replace(/\r\n?/g, "\n").trim();
  const length = Array.from(body).length;
  return length > 0 && length <= PROJECT_CHAT_MAX ? body : null;
}

export function validateProjectFile({
  mimeType,
  sizeBytes,
}: {
  mimeType: string;
  sizeBytes: number;
}): "ok" | "type" | "size" {
  if (!PROJECT_FILE_TYPES.has(mimeType)) return "type";
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > PROJECT_FILE_MAX_BYTES) {
    return "size";
  }
  return "ok";
}

export function canAssign(
  orgId: string,
  project: { orgId: string; memberOrgIds: readonly string[] },
): boolean {
  return orgId === project.orgId || project.memberOrgIds.includes(orgId);
}
