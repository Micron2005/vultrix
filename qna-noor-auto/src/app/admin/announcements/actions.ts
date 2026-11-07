"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SUPPORT_EMAIL } from "@/lib/branding";
import {
  announcementEmailHtml,
  announcementListUnsubscribeHeaders,
  announcementUnsubscribeUrl,
} from "@/lib/announcementEmail";
import {
  processAnnouncementBatch,
  type AnnouncementBatchGateway,
} from "@/lib/announcementBatch";
import {
  collectRecipients,
  DEFAULT_ANNOUNCEMENT_BODY,
  DEFAULT_ANNOUNCEMENT_SUBJECT,
} from "@/lib/announcements";
import { DEMO_ORG_ID } from "@/lib/demoIds";
import { db } from "@/lib/db";
import { sendEmailResult } from "@/lib/email";
import { requireSuperadmin } from "@/lib/session";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function readContent(formData: FormData):
  | { subject: string; body: string }
  | { error: string } {
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (subject.length < 1 || subject.length > 150) {
    return { error: "Subject must be between 1 and 150 characters." };
  }
  if (body.trim().length < 1 || body.length > 10_000) {
    return { error: "Body must be between 1 and 10,000 characters." };
  }
  return { subject, body };
}

async function recipientOrganizations() {
  return db.organization.findMany({
    where: { id: { not: DEMO_ORG_ID } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      announcementsOptOut: true,
      billingEmail: true,
      users: {
        where: { role: "OWNER" },
        orderBy: { createdAt: "asc" },
        select: { role: true, email: true },
      },
    },
  });
}

export async function createAnnouncementDraft(): Promise<void> {
  await requireSuperadmin();
  const announcement = await db.announcement.create({
    data: {
      subject: DEFAULT_ANNOUNCEMENT_SUBJECT,
      body: DEFAULT_ANNOUNCEMENT_BODY,
    },
    select: { id: true },
  });
  redirect(`/admin/announcements?id=${encodeURIComponent(announcement.id)}`);
}

export async function saveAnnouncementDraft(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string; testSentAt?: string | null }> {
  await requireSuperadmin();
  const content = readContent(formData);
  if ("error" in content) return { ok: false, error: content.error };
  const announcement = await db.announcement.findUnique({
    where: { id },
    select: { subject: true, body: true, status: true, testSentAt: true },
  });
  if (!announcement || announcement.status !== "draft") {
    return { ok: false, error: "Only drafts can be edited." };
  }
  const changed =
    announcement.subject !== content.subject || announcement.body !== content.body;
  const updated = await db.announcement.updateMany({
    where: { id, status: "draft" },
    data: {
      ...content,
      ...(changed ? { testSentAt: null, testSentTo: null } : {}),
    },
  });
  if (updated.count === 0) {
    return { ok: false, error: "Only drafts can be edited." };
  }
  revalidatePath("/admin/announcements");
  return {
    ok: true,
    testSentAt: changed ? null : announcement.testSentAt?.toISOString() ?? null,
  };
}

export async function sendAnnouncementTest(
  id: string,
  formData: FormData,
): Promise<{ ok: boolean; error: string | null; testSentAt: string | null }> {
  await requireSuperadmin();
  const content = readContent(formData);
  if ("error" in content) {
    return { ok: false, error: content.error, testSentAt: null };
  }
  const to = String(formData.get("to") ?? "").trim();
  if (!EMAIL_RE.test(to)) {
    return {
      ok: false,
      error: "Enter a valid test email address.",
      testSentAt: null,
    };
  }
  const announcement = await db.announcement.findUnique({
    where: { id },
    select: { subject: true, body: true, status: true },
  });
  if (!announcement || announcement.status !== "draft") {
    return {
      ok: false,
      error: "Only drafts can be test-sent.",
      testSentAt: null,
    };
  }
  const saved = await db.announcement.updateMany({
    where: { id, status: "draft" },
    data: { ...content, testSentAt: null, testSentTo: null },
  });
  if (saved.count === 0) {
    return {
      ok: false,
      error: "Only drafts can be test-sent.",
      testSentAt: null,
    };
  }

  try {
    const unsubscribeUrl = announcementUnsubscribeUrl(DEMO_ORG_ID);
    const result = await sendEmailResult({
      kind: "announcement_test",
      orgId: null,
      to,
      subject: content.subject,
      html: announcementEmailHtml(content.body, unsubscribeUrl),
      replyTo: SUPPORT_EMAIL,
      headers: announcementListUnsubscribeHeaders(DEMO_ORG_ID),
    });
    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? "Test email was not sent.",
        testSentAt: null,
      };
    }
    const testSentAt = new Date();
    const marked = await db.announcement.updateMany({
      where: {
        id,
        status: "draft",
        subject: content.subject,
        body: content.body,
      },
      data: { testSentAt, testSentTo: to },
    });
    if (marked.count === 0) {
      return {
        ok: false,
        error: "The draft changed during the test send. Send another test.",
        testSentAt: null,
      };
    }
    revalidatePath("/admin/announcements");
    return { ok: true, error: null, testSentAt: testSentAt.toISOString() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Test email was not sent.",
      testSentAt: null,
    };
  }
}

export async function startAnnouncementSend(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperadmin();
  const orgs = await recipientOrganizations();
  const recipients = collectRecipients(orgs);
  const started = await db.$transaction(async (tx) => {
    const transition = await tx.announcement.updateMany({
      where: { id, status: "draft", testSentAt: { not: null } },
      data: { status: "sending", sentAt: null },
    });
    if (transition.count === 0) return false;
    if (recipients.length > 0) {
      await tx.announcementRecipient.createMany({
        data: recipients.map((recipient) => ({
          announcementId: id,
          orgId: recipient.orgId,
          email: recipient.email,
        })),
        skipDuplicates: true,
      });
    }
    return true;
  });
  if (!started) {
    return {
      ok: false,
      error: "A successful test send is required, and only drafts can be sent.",
    };
  }
  revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function retryFailedAnnouncementRecipients(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperadmin();
  const started = await db.$transaction(async (tx) => {
    const failedCount = await tx.announcementRecipient.count({
      where: { announcementId: id, status: "failed" },
    });
    if (failedCount === 0) return false;
    const transition = await tx.announcement.updateMany({
      where: { id, status: "sent" },
      data: { status: "sending", sentAt: null },
    });
    if (transition.count === 0) return false;
    await tx.announcementRecipient.updateMany({
      where: { announcementId: id, status: "failed" },
      data: { status: "pending", error: null, sentAt: null },
    });
    return true;
  });
  if (!started) {
    return { ok: false, error: "There are no failed recipients to retry." };
  }
  revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function sendAnnouncementBatch(
  id: string,
): Promise<{
  ok: boolean;
  error?: string;
  status: string;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  processed: number;
}> {
  await requireSuperadmin();
  const announcement = await db.announcement.findUnique({
    where: { id },
    select: { subject: true, body: true, status: true },
  });
  if (!announcement) {
    return {
      ok: false,
      error: "Announcement not found.",
      status: "sent",
      sentCount: 0,
      failedCount: 0,
      pendingCount: 0,
      processed: 0,
    };
  }

  let processed = 0;
  if (announcement.status === "sending") {
    const gateway: AnnouncementBatchGateway = {
      async processNext(announcementId, send) {
        return db.$transaction(
          async (tx) => {
            const recipients = await tx.$queryRaw<
              Array<{ id: string; orgId: string; email: string }>
            >`
              SELECT "id", "orgId", "email"
              FROM "AnnouncementRecipient"
              WHERE "announcementId" = ${announcementId}
                AND "status" = 'pending'
              ORDER BY "id"
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            `;
            const recipient = recipients[0];
            if (!recipient) return false;
            const orgs = await tx.$queryRaw<
              Array<{ announcementsOptOut: boolean }>
            >`
              SELECT "announcementsOptOut"
              FROM "Organization"
              WHERE "id" = ${recipient.orgId}
              FOR UPDATE
            `;
            const org = orgs[0];
            if (!org || org.announcementsOptOut) {
              await tx.announcementRecipient.delete({
                where: { id: recipient.id },
              });
              return true;
            }
            const result = await send(recipient);
            await tx.announcementRecipient.update({
              where: { id: recipient.id },
              data: {
                status: result.ok ? "sent" : "failed",
                error: result.error,
                sentAt: result.ok ? new Date() : null,
              },
            });
            return true;
          },
          { maxWait: 10_000, timeout: 30_000 },
        );
      },
      pendingCount(announcementId) {
        return db.announcementRecipient.count({
          where: { announcementId, status: "pending" },
        });
      },
      async markComplete(announcementId) {
        await db.announcement.updateMany({
          where: { id: announcementId, status: "sending" },
          data: { status: "sent", sentAt: new Date() },
        });
      },
    };
    const result = await processAnnouncementBatch(
      id,
      gateway,
      async (recipient) => {
        try {
          return await sendEmailResult({
            kind: "announcement",
            orgId: recipient.orgId,
            to: recipient.email,
            subject: announcement.subject,
            html: announcementEmailHtml(
              announcement.body,
              announcementUnsubscribeUrl(recipient.orgId),
            ),
            replyTo: SUPPORT_EMAIL,
            headers: announcementListUnsubscribeHeaders(recipient.orgId),
          });
        } catch (error) {
          return {
            ok: false,
            error:
              error instanceof Error ? error.message : "Announcement send failed.",
          };
        }
      },
    );
    processed = result.processed;
  }

  const [updated, sentCount, failedCount, pendingCount] = await Promise.all([
    db.announcement.findUnique({
      where: { id },
      select: { status: true },
    }),
    db.announcementRecipient.count({
      where: { announcementId: id, status: "sent" },
    }),
    db.announcementRecipient.count({
      where: { announcementId: id, status: "failed" },
    }),
    db.announcementRecipient.count({
      where: { announcementId: id, status: "pending" },
    }),
  ]);
  revalidatePath("/admin/announcements");
  return {
    ok: true,
    status: updated?.status ?? announcement.status,
    sentCount,
    failedCount,
    pendingCount,
    processed,
  };
}
