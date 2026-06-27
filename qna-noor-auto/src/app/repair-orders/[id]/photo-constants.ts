// Shared constants/types for repair-order photos. Kept out of the "use server"
// action module, which may only export async functions.

export const MAX_PHOTOS_PER_RO = 24;

export type NewPhoto = { dataUrl: string; caption?: string };

export type PhotoActionResult = { ok: boolean; error?: string };
