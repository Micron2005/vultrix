-- Soft delete for repair orders: deleting a ticket now sets deletedAt (moves it
-- to Trash) instead of destroying the ticket and its invoice/line items.
ALTER TABLE "RepairOrder" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "RepairOrder_orgId_deletedAt_idx" ON "RepairOrder"("orgId", "deletedAt");
