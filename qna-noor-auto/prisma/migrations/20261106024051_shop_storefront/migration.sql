ALTER TABLE "Part"
ADD COLUMN "shopListed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "tagline" TEXT,
    "shipEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shipFlatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pickupNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductPhoto" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopOrder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "publicToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fulfillment" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "shipping" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "stripeSessionId" TEXT,
    "paymentIntentId" TEXT,
    "buyerName" TEXT,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "shipAddress" JSONB,
    "trackingNumber" TEXT,
    "paidAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "partId" TEXT,
    "itemName" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ShopOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Shop_orgId_key" ON "Shop"("orgId");
CREATE UNIQUE INDEX "Shop_slug_key" ON "Shop"("slug");
CREATE INDEX "ProductPhoto_partId_idx" ON "ProductPhoto"("partId");
CREATE UNIQUE INDEX "ShopOrder_publicToken_key" ON "ShopOrder"("publicToken");
CREATE UNIQUE INDEX "ShopOrder_stripeSessionId_key" ON "ShopOrder"("stripeSessionId");
CREATE UNIQUE INDEX "ShopOrder_orgId_number_key" ON "ShopOrder"("orgId", "number");
CREATE INDEX "ShopOrder_orgId_status_idx" ON "ShopOrder"("orgId", "status");

ALTER TABLE "Shop"
ADD CONSTRAINT "Shop_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductPhoto"
ADD CONSTRAINT "ProductPhoto_partId_fkey"
FOREIGN KEY ("partId") REFERENCES "Part"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductPhoto"
ADD CONSTRAINT "ProductPhoto_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopOrder"
ADD CONSTRAINT "ShopOrder_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopOrderLine"
ADD CONSTRAINT "ShopOrderLine_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "ShopOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShopOrderLine"
ADD CONSTRAINT "ShopOrderLine_partId_fkey"
FOREIGN KEY ("partId") REFERENCES "Part"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD COLUMN "shopOrderId" TEXT;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_shopOrderId_fkey"
FOREIGN KEY ("shopOrderId") REFERENCES "ShopOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
