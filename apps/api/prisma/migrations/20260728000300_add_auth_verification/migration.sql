-- Existing accounts remain usable; only newly registered accounts require verification.
ALTER TABLE "User"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET "emailVerifiedAt" = "createdAt"
WHERE "emailVerifiedAt" IS NULL;

CREATE TYPE "AuthCodePurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

CREATE TABLE "AuthCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthCode_userId_purpose_createdAt_idx"
ON "AuthCode"("userId", "purpose", "createdAt");

CREATE INDEX "AuthCode_expiresAt_idx" ON "AuthCode"("expiresAt");

ALTER TABLE "AuthCode"
ADD CONSTRAINT "AuthCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
