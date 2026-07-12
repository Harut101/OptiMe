CREATE TYPE "FoodCatalogSource" AS ENUM ('CURATED', 'USDA_FDC');

CREATE TYPE "FoodCatalogCategory" AS ENUM (
  'PROTEIN',
  'GRAIN',
  'LEGUME',
  'VEGETABLE',
  'FRUIT',
  'DAIRY_OR_ALTERNATIVE',
  'FAT',
  'OTHER'
);

CREATE TABLE "FoodCatalogItem" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "source" "FoodCatalogSource" NOT NULL DEFAULT 'CURATED',
  "sourceFoodId" TEXT,
  "category" "FoodCatalogCategory" NOT NULL,
  "caloriesPer100g" INTEGER NOT NULL,
  "proteinPer100g" DECIMAL(7,2) NOT NULL,
  "carbsPer100g" DECIMAL(7,2) NOT NULL,
  "fatPer100g" DECIMAL(7,2) NOT NULL,
  "fiberPer100g" DECIMAL(7,2),
  "dietTypes" "DietType"[] DEFAULT ARRAY[]::"DietType"[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FoodCatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodCatalogTranslation" (
  "id" TEXT NOT NULL,
  "foodCatalogItemId" TEXT NOT NULL,
  "locale" "PreferredLocale" NOT NULL,
  "name" TEXT NOT NULL,
  "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FoodCatalogTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodCatalogItem_slug_key" ON "FoodCatalogItem"("slug");
CREATE UNIQUE INDEX "FoodCatalogItem_source_sourceFoodId_key" ON "FoodCatalogItem"("source", "sourceFoodId");
CREATE INDEX "FoodCatalogItem_isActive_sortOrder_slug_idx" ON "FoodCatalogItem"("isActive", "sortOrder", "slug");
CREATE INDEX "FoodCatalogItem_category_isActive_idx" ON "FoodCatalogItem"("category", "isActive");

CREATE UNIQUE INDEX "FoodCatalogTranslation_foodCatalogItemId_locale_key" ON "FoodCatalogTranslation"("foodCatalogItemId", "locale");
CREATE INDEX "FoodCatalogTranslation_locale_name_idx" ON "FoodCatalogTranslation"("locale", "name");

ALTER TABLE "FoodCatalogTranslation"
ADD CONSTRAINT "FoodCatalogTranslation_foodCatalogItemId_fkey"
FOREIGN KEY ("foodCatalogItemId") REFERENCES "FoodCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
