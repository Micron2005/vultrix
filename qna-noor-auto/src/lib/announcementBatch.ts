export type PendingAnnouncementRecipient = {
  id: string;
  orgId: string;
  email: string;
};

export type AnnouncementBatchSendResult = {
  ok: boolean;
  error: string | null;
};

export type AnnouncementBatchGateway = {
  processNext: (
    announcementId: string,
    send: (
      recipient: PendingAnnouncementRecipient,
    ) => Promise<AnnouncementBatchSendResult>,
  ) => Promise<boolean>;
  pendingCount: (announcementId: string) => Promise<number>;
  markComplete: (announcementId: string) => Promise<void>;
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function processAnnouncementBatch(
  announcementId: string,
  gateway: AnnouncementBatchGateway,
  send: (
    recipient: PendingAnnouncementRecipient,
  ) => Promise<AnnouncementBatchSendResult>,
  delay: (milliseconds: number) => Promise<void> = wait,
): Promise<{ processed: number; left: number }> {
  let processed = 0;

  while (processed < 25) {
    if (!(await gateway.processNext(announcementId, send))) break;
    processed += 1;
    await delay(600);
  }

  const left = await gateway.pendingCount(announcementId);
  if (left === 0) await gateway.markComplete(announcementId);
  return { processed, left };
}
