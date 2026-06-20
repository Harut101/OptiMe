CREATE TYPE "ExerciseCategory" AS ENUM ('STRENGTH', 'MOBILITY', 'CARDIO', 'RECOVERY');
CREATE TYPE "ExerciseEquipment" AS ENUM ('NONE', 'BODYWEIGHT', 'DUMBBELLS', 'BARBELL', 'KETTLEBELL', 'RESISTANCE_BANDS', 'MACHINES', 'BENCH', 'PULL_UP_BAR', 'CABLE_MACHINE', 'CARDIO_MACHINE');
CREATE TYPE "MovementPattern" AS ENUM ('SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'HORIZONTAL_PULL', 'VERTICAL_PULL', 'LUNGE', 'CARRY', 'ROTATION', 'ANTI_ROTATION', 'CORE_FLEXION', 'CORE_STABILITY', 'ISOLATION', 'MOBILITY', 'CARDIO', 'RECOVERY');
CREATE TYPE "ExerciseContraindicationTag" AS ENUM ('WRIST_LOAD', 'ELBOW_LOAD', 'SHOULDER_LOAD', 'KNEE_LOAD', 'LOWER_BACK_LOAD', 'OVERHEAD_POSITION', 'BALANCE_REQUIRED', 'HIGH_IMPACT', 'PRONE_POSITION', 'SUPINE_POSITION', 'PREGNANCY_REVIEW', 'POSTPARTUM_REVIEW');
CREATE TYPE "ExerciseMediaType" AS ENUM ('PRIMARY', 'TECHNIQUE', 'ANATOMY', 'ALTERNATE');

CREATE TABLE "Exercise" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "category" "ExerciseCategory" NOT NULL,
  "movementPattern" "MovementPattern" NOT NULL,
  "equipment" "ExerciseEquipment"[] NOT NULL DEFAULT ARRAY[]::"ExerciseEquipment"[],
  "targetMuscles" "TargetMuscleGroup"[] NOT NULL DEFAULT ARRAY[]::"TargetMuscleGroup"[],
  "secondaryMuscles" "TargetMuscleGroup"[] NOT NULL DEFAULT ARRAY[]::"TargetMuscleGroup"[],
  "trainingLevels" "TrainingLevel"[] NOT NULL DEFAULT ARRAY[]::"TrainingLevel"[],
  "contraindicationTags" "ExerciseContraindicationTag"[] NOT NULL DEFAULT ARRAY[]::"ExerciseContraindicationTag"[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Exercise_slug_nonempty" CHECK (length(trim("slug")) > 0),
  CONSTRAINT "Exercise_sort_order_nonnegative" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "ExerciseTranslation" (
  "id" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "locale" "PreferredLocale" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "instructions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "coachingCues" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "safetyNotes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseTranslation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseTranslation_name_nonempty" CHECK (length(trim("name")) > 0)
);

CREATE TABLE "ExerciseMedia" (
  "id" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "seedKey" TEXT,
  "type" "ExerciseMediaType" NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT,
  "license" TEXT,
  "attribution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseMedia_url_nonempty" CHECK (length(trim("url")) > 0),
  CONSTRAINT "ExerciseMedia_sort_order_nonnegative" CHECK ("sortOrder" >= 0),
  CONSTRAINT "ExerciseMedia_dimensions_pair" CHECK (("width" IS NULL AND "height" IS NULL) OR ("width" > 0 AND "height" > 0))
);

CREATE TABLE "ExerciseMediaTranslation" (
  "id" TEXT NOT NULL,
  "exerciseMediaId" TEXT NOT NULL,
  "locale" "PreferredLocale" NOT NULL,
  "altText" TEXT NOT NULL,
  "caption" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseMediaTranslation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExerciseMediaTranslation_alt_text_nonempty" CHECK (length(trim("altText")) > 0)
);

CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");
CREATE INDEX "Exercise_isActive_sortOrder_slug_idx" ON "Exercise"("isActive", "sortOrder", "slug");
CREATE INDEX "Exercise_category_isActive_idx" ON "Exercise"("category", "isActive");
CREATE INDEX "Exercise_movementPattern_isActive_idx" ON "Exercise"("movementPattern", "isActive");
CREATE UNIQUE INDEX "ExerciseTranslation_exerciseId_locale_key" ON "ExerciseTranslation"("exerciseId", "locale");
CREATE INDEX "ExerciseTranslation_locale_name_idx" ON "ExerciseTranslation"("locale", "name");
CREATE UNIQUE INDEX "ExerciseMedia_seedKey_key" ON "ExerciseMedia"("seedKey");
CREATE INDEX "ExerciseMedia_exerciseId_isActive_sortOrder_idx" ON "ExerciseMedia"("exerciseId", "isActive", "sortOrder");
CREATE INDEX "ExerciseMedia_exerciseId_isPrimary_isActive_idx" ON "ExerciseMedia"("exerciseId", "isPrimary", "isActive");
CREATE UNIQUE INDEX "ExerciseMedia_one_active_primary_per_exercise" ON "ExerciseMedia"("exerciseId") WHERE "isPrimary" = true AND "isActive" = true;
CREATE UNIQUE INDEX "ExerciseMediaTranslation_exerciseMediaId_locale_key" ON "ExerciseMediaTranslation"("exerciseMediaId", "locale");
CREATE INDEX "ExerciseMediaTranslation_locale_idx" ON "ExerciseMediaTranslation"("locale");

ALTER TABLE "ExerciseTranslation" ADD CONSTRAINT "ExerciseTranslation_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExerciseMedia" ADD CONSTRAINT "ExerciseMedia_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExerciseMediaTranslation" ADD CONSTRAINT "ExerciseMediaTranslation_exerciseMediaId_fkey" FOREIGN KEY ("exerciseMediaId") REFERENCES "ExerciseMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
