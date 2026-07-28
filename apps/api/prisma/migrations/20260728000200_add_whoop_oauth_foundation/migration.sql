-- CreateTable
CREATE TABLE "WhoopOAuthCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessTokenCiphertext" TEXT NOT NULL,
    "refreshTokenCiphertext" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "externalUserId" TEXT,
    "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhoopOAuthCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhoopOAuthState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhoopOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhoopOAuthCredential_userId_key" ON "WhoopOAuthCredential"("userId");

-- CreateIndex
CREATE INDEX "WhoopOAuthCredential_accessTokenExpiresAt_idx" ON "WhoopOAuthCredential"("accessTokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhoopOAuthState_stateHash_key" ON "WhoopOAuthState"("stateHash");

-- CreateIndex
CREATE INDEX "WhoopOAuthState_userId_expiresAt_idx" ON "WhoopOAuthState"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "WhoopOAuthState_expiresAt_consumedAt_idx" ON "WhoopOAuthState"("expiresAt", "consumedAt");

-- AddForeignKey
ALTER TABLE "WhoopOAuthCredential" ADD CONSTRAINT "WhoopOAuthCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhoopOAuthState" ADD CONSTRAINT "WhoopOAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
