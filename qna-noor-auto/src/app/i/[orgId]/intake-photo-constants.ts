// Shared constants for public intake photos. Kept out of the "use server"
// action module (which may only export async functions) so both the client
// picker and the server action can import them.

export const MAX_INTAKE_PHOTOS = 8;

// Generous per-image ceiling. The client resizes/compresses before submit, so
// real photos land well under this; the cap just guards against abuse.
export const MAX_INTAKE_DATAURL_BYTES = 4 * 1024 * 1024; // ~4MB encoded
