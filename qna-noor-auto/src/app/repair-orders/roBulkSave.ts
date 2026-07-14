/**
 * Shared types for the Repair Order "save everything" flow. Kept in a plain
 * module (NOT a "use server" file) so both the server action and the client
 * SaveAllButton can import them without violating the rule that a "use server"
 * module may only export async functions.
 */

/**
 * Field map submitted for a single line item, keyed by the input `name`
 * (e.g. { description, hours, rate } for labor). Raw string values straight
 * from the form; parsing/validation happens server-side.
 */
export type LineFieldMap = Record<string, string>;

/**
 * Payload gathered by the global "Save" button on the RO detail page. It
 * bundles the Details form together with EVERY editable line item so a single
 * click persists the whole page — fixing the bug where typing a new price in a
 * line and hitting the bottom "Save" silently discarded it (that button only
 * ever submitted the Details form).
 */
export type RoBulkSavePayload = {
  details: LineFieldMap;
  labor: { id: string; fields: LineFieldMap }[];
  parts: { id: string; fields: LineFieldMap }[];
  fees: { id: string; fields: LineFieldMap }[];
  /** When true, redirect to the dashboard after saving (Save & exit). */
  exit?: boolean;
};
