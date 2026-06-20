CREATE TYPE "PreferredLocale" AS ENUM ('en-US', 'ru-RU', 'fr-FR', 'zh-CN');
CREATE TYPE "MeasurementSystem" AS ENUM ('METRIC', 'IMPERIAL');

CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredLocale" "PreferredLocale" NOT NULL DEFAULT 'en-US',
    "measurementSystem" "MeasurementSystem" NOT NULL DEFAULT 'METRIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE INDEX "UserSettings_preferredLocale_idx" ON "UserSettings"("preferredLocale");
CREATE INDEX "UserSettings_measurementSystem_idx" ON "UserSettings"("measurementSystem");

ALTER TABLE "UserSettings"
ADD CONSTRAINT "UserSettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
