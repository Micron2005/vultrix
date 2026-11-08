import assert from "node:assert/strict";
import test from "node:test";
import {
  processAnnouncementBatch,
  type AnnouncementBatchGateway,
  type PendingAnnouncementRecipient,
} from "./announcementBatch";

test("announcement batches process at most 25 recipients sequentially", async () => {
  const queued: PendingAnnouncementRecipient[] = Array.from(
    { length: 27 },
    (_, index) => ({
      id: `recipient-${index}`,
      orgId: `org-${index}`,
      email: `owner${index}@example.com`,
    }),
  );
  const sent: string[] = [];
  const delays: number[] = [];
  let completed = 0;
  const gateway: AnnouncementBatchGateway = {
    async processNext(_id, send) {
      const recipient = queued.shift();
      if (!recipient) return false;
      const result = await send(recipient);
      assert.equal(result.ok, true);
      return true;
    },
    async pendingCount() {
      return queued.length;
    },
    async markComplete() {
      completed += 1;
    },
  };
  const sender = async (recipient: PendingAnnouncementRecipient) => {
    sent.push(recipient.id);
    return { ok: true, error: null };
  };
  const delay = async (milliseconds: number) => {
    delays.push(milliseconds);
  };

  const first = await processAnnouncementBatch("announcement-1", gateway, sender, delay);
  assert.deepEqual(first, { processed: 25, left: 2 });
  assert.equal(completed, 0);
  assert.equal(sent.length, 25);
  assert.deepEqual(delays, Array.from({ length: 25 }, () => 600));

  const second = await processAnnouncementBatch("announcement-1", gateway, sender, delay);
  assert.deepEqual(second, { processed: 2, left: 0 });
  assert.equal(completed, 1);
  assert.equal(sent.length, 27);
});
