import crypto from "node:crypto";
import { DEMO_ORG_ID } from "@/lib/demoIds";

export const DEFAULT_ANNOUNCEMENT_SUBJECT =
  "Work together on Vultrix: People, Messages and Projects";
export const DEFAULT_ANNOUNCEMENT_BODY = `Vultrix started as a tool to run a shop. What I'm building toward is a place that helps people improve their business and themselves, whatever that looks like for you.

The next step is working together. Find someone by name, follow each other, message them, and start a shared project: a song, a job, a plan, anything. It works between people and businesses.

Your profile stays private unless you turn it on, and nobody gets suggested to you.

— Mukarram`;

export type AnnouncementOrg = {
  id: string;
  announcementsOptOut: boolean;
  billingEmail: string | null;
  users: Array<{ role: string; email: string | null }>;
};

export type AnnouncementRecipientAddress = {
  orgId: string;
  email: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function announcementSecret(): string | null {
  return (
    process.env.INTAKE_SIGNING_SECRET ||
    process.env.STOCK_SCAN_SIGNING_SECRET ||
    null
  );
}

function normalizedEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email && EMAIL_RE.test(email) ? email : null;
}

export function collectRecipients(
  orgs: readonly AnnouncementOrg[],
): AnnouncementRecipientAddress[] {
  const recipients: AnnouncementRecipientAddress[] = [];
  const seen = new Set<string>();

  for (const org of orgs) {
    if (org.id === DEMO_ORG_ID || org.announcementsOptOut) continue;

    const ownerEmails = org.users
      .filter((user) => user.role === "OWNER")
      .map((user) => normalizedEmail(user.email))
      .filter((email): email is string => email !== null);
    const emails =
      ownerEmails.length > 0
        ? ownerEmails
        : [normalizedEmail(org.billingEmail)].filter(
            (email): email is string => email !== null,
          );

    for (const email of emails) {
      if (seen.has(email)) continue;
      seen.add(email);
      recipients.push({ orgId: org.id, email });
    }
  }

  return recipients;
}

export function unsubscribeToken(orgId: string): string | null {
  const secret = announcementSecret();
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(orgId)
    .digest("base64url");
}

export function verifyUnsubscribeToken(orgId: string, token: string): boolean {
  const expected = unsubscribeToken(orgId);
  if (!expected || !token || expected.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(token, "utf8"),
    );
  } catch {
    return false;
  }
}
