CREATE TYPE "FoodPreparationLevel" AS ENUM (
  'READY_TO_EAT',
  'QUICK_ASSEMBLY',
  'COOK_REQUIRED'
);

ALTER TABLE "FoodCatalogItem"
ADD COLUMN "preparationLevel" "FoodPreparationLevel" NOT NULL DEFAULT 'COOK_REQUIRED';
