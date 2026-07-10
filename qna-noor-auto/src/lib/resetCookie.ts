// Short-lived cookie carrying the identifier a user requested a reset code for,
// so the reset page can prefill it (and resolve the code) without exposing the
// username in the URL. Kept in a plain module because "use server" files may
// only export async functions.
export const RESET_ID_COOKIE = "pwr_id";
