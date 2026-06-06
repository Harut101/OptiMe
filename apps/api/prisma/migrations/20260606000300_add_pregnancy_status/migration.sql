CREATE TYPE "PregnancyStatus" AS ENUM (
    'NOT_PREGNANT',
    'PREGNANT',
    'POSTPARTUM',
    'BREASTFEEDING',
    'PREFER_NOT_TO_SAY',
    'UNKNOWN'
);

ALTER TABLE "Profile" ADD COLUMN "pregnancyStatus" "PregnancyStatus" NOT NULL DEFAULT 'UNKNOWN';

CREATE INDEX "Profile_pregnancyStatus_idx" ON "Profile"("pregnancyStatus");
