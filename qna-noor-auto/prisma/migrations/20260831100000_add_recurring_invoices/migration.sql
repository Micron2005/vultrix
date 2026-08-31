ALTER TABLE "RepairOrder"
ADD COLUMN "recurringInvoiceId" TEXT,
ADD COLUMN "recurringOccurrence" TIMESTAMP(3);

CREATE TABLE "RecurringInvoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "interval" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastPostedAt" TIMESTAMP(3),
    "autoPost" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "label" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringInvoiceLine" (
    "id" TEXT NOT NULL,
    "recurringInvoiceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "partNumber" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecurringInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RepairOrder_recurringInvoiceId_recurringOccurrence_key"
ON "RepairOrder"("recurringInvoiceId", "recurringOccurrence");

CREATE INDEX "RecurringInvoice_orgId_idx"
ON "RecurringInvoice"("orgId");

CREATE INDEX "RecurringInvoice_active_nextRunAt_idx"
ON "RecurringInvoice"("active", "nextRunAt");

CREATE INDEX "RecurringInvoiceLine_recurringInvoiceId_idx"
ON "RecurringInvoiceLine"("recurringInvoiceId");

ALTER TABLE "RepairOrder"
ADD CONSTRAINT "RepairOrder_recurringInvoiceId_fkey"
FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringInvoice"
ADD CONSTRAINT "RecurringInvoice_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "RecurringInvoice_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "RecurringInvoice_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringInvoiceLine"
ADD CONSTRAINT "RecurringInvoiceLine_recurringInvoiceId_fkey"
FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
