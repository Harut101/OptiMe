CREATE TABLE "DislikedFood" (
    "id" TEXT NOT NULL,
    "nutritionPreferenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DislikedFood_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DislikedFood_nutritionPreferenceId_idx" ON "DislikedFood"("nutritionPreferenceId");

ALTER TABLE "DislikedFood"
ADD CONSTRAINT "DislikedFood_nutritionPreferenceId_fkey"
FOREIGN KEY ("nutritionPreferenceId") REFERENCES "NutritionPreference"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
