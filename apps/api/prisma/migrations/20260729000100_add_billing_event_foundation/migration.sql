CREATE TYPE "BillingEventProvider" AS ENUM ('REVENUECAT');

CREATE TYPE "BillingEventProcessingStatus" AS ENUM (
    'RECEIVED',
    'PROCESSED',
    'IGNORED',
    'FAILED'
);

CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingEventProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "BillingEventProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "environment" "SubscriptionEnvironment",
    "store" "SubscriptionProvider",
    "userId" TEXT,
    "subscriptionId" TEXT,
    "providerCustomerId" TEXT,
    "providerProductId" TEXT,
    "occurredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "safeErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingEvent_provider_providerEventId_key"
ON "BillingEvent"("provider", "providerEventId");

CREATE INDEX "BillingEvent_provider_status_receivedAt_idx"
ON "BillingEvent"("provider", "status", "receivedAt");

CREATE INDEX "BillingEvent_userId_receivedAt_idx"
ON "BillingEvent"("userId", "receivedAt");

CREATE INDEX "BillingEvent_subscriptionId_receivedAt_idx"
ON "BillingEvent"("subscriptionId", "receivedAt");

CREATE INDEX "BillingEvent_providerCustomerId_receivedAt_idx"
ON "BillingEvent"("providerCustomerId", "receivedAt");

ALTER TABLE "BillingEvent"
ADD CONSTRAINT "BillingEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingEvent"
ADD CONSTRAINT "BillingEvent_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
