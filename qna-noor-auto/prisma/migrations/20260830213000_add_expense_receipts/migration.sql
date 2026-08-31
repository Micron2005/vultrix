CREATE TABLE "ExpenseReceipt" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExpenseReceipt_expenseId_idx" ON "ExpenseReceipt"("expenseId");
CREATE INDEX "ExpenseReceipt_orgId_idx" ON "ExpenseReceipt"("orgId");

ALTER TABLE "ExpenseReceipt" ADD CONSTRAINT "ExpenseReceipt_expenseId_fkey"
FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseReceipt" ADD CONSTRAINT "ExpenseReceipt_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
