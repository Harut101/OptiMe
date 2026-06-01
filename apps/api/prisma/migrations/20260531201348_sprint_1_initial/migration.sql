-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('HEALTHY_LIFESTYLE', 'IMPROVE_FITNESS', 'BUILD_MUSCLE', 'IMPROVE_ENDURANCE', 'REDUCE_WEIGHT');

-- CreateEnum
CREATE TYPE "GoalImpactMode" AS ENUM ('NUTRITION_ONLY', 'NUTRITION_AND_TRAINING');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('NONE', 'OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'KETO', 'LOW_CARB', 'MEDITERRANEAN', 'HALAL', 'KOSHER');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('LOW', 'LIGHT', 'MODERATE', 'HIGH', 'ATHLETE');

-- CreateEnum
CREATE TYPE "SportType" AS ENUM ('RUNNING', 'CYCLING', 'GYM', 'STRENGTH', 'HIIT', 'YOGA', 'SWIMMING', 'WALKING', 'TEAM_SPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "IntensityLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('READY', 'FALLBACK');

-- CreateEnum
CREATE TYPE "DailyReadinessLevel" AS ENUM ('RECOVER', 'MAINTAIN', 'PUSH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "safeMode" BOOLEAN NOT NULL DEFAULT false,
    "privacyConsentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "activityLevel" "ActivityLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "targetWeightKg" DOUBLE PRECISION,
    "targetTimelineDays" INTEGER,
    "impactMode" "GoalImpactMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dietType" "DietType" NOT NULL DEFAULT 'NONE',
    "mealsPerDay" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" TEXT NOT NULL,
    "nutritionPreferenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcludedFood" (
    "id" TEXT NOT NULL,
    "nutritionPreferenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExcludedFood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferredFood" (
    "id" TEXT NOT NULL,
    "nutritionPreferenceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PreferredFood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingScheduleItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "localTime" TEXT NOT NULL,
    "sportType" "SportType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "intensity" "IntensityLevel" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planLocalDate" TEXT NOT NULL,
    "planTimezone" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL,
    "readinessLevel" "DailyReadinessLevel" NOT NULL,
    "planJson" JSONB NOT NULL,
    "createdByAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_dateOfBirth_idx" ON "Profile"("dateOfBirth");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_userId_key" ON "Goal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionPreference_userId_key" ON "NutritionPreference"("userId");

-- CreateIndex
CREATE INDEX "Allergy_nutritionPreferenceId_idx" ON "Allergy"("nutritionPreferenceId");

-- CreateIndex
CREATE INDEX "ExcludedFood_nutritionPreferenceId_idx" ON "ExcludedFood"("nutritionPreferenceId");

-- CreateIndex
CREATE INDEX "PreferredFood_nutritionPreferenceId_idx" ON "PreferredFood"("nutritionPreferenceId");

-- CreateIndex
CREATE INDEX "TrainingScheduleItem_userId_dayOfWeek_idx" ON "TrainingScheduleItem"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "DailyPlan_userId_createdAt_idx" ON "DailyPlan"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlan_userId_planLocalDate_planTimezone_key" ON "DailyPlan"("userId", "planLocalDate", "planTimezone");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPreference" ADD CONSTRAINT "NutritionPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_nutritionPreferenceId_fkey" FOREIGN KEY ("nutritionPreferenceId") REFERENCES "NutritionPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcludedFood" ADD CONSTRAINT "ExcludedFood_nutritionPreferenceId_fkey" FOREIGN KEY ("nutritionPreferenceId") REFERENCES "NutritionPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferredFood" ADD CONSTRAINT "PreferredFood_nutritionPreferenceId_fkey" FOREIGN KEY ("nutritionPreferenceId") REFERENCES "NutritionPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingScheduleItem" ADD CONSTRAINT "TrainingScheduleItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlan" ADD CONSTRAINT "DailyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
