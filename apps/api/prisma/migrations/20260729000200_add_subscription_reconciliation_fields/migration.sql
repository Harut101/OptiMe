ALTER TABLE "Subscription"
ADD COLUMN "graceEndsAt" TIMESTAMP(3),
ADD COLUMN "willRenew" BOOLEAN,
ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN "lastProviderEventAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "Subscription_provider_providerSubscriptionId_idx";

CREATE UNIQUE INDEX "Subscription_provider_environment_providerSubscriptionId_key"
ON "Subscription"("provider", "environment", "providerSubscriptionId");
