CREATE TYPE "FoodRestrictionTag" AS ENUM (
  'DAIRY',
  'EGG',
  'FISH',
  'SHELLFISH',
  'PEANUT',
  'TREE_NUT',
  'SOY',
  'SESAME',
  'WHEAT',
  'GLUTEN'
);

ALTER TABLE "FoodCatalogItem"
ADD COLUMN "restrictionTags" "FoodRestrictionTag"[] NOT NULL DEFAULT ARRAY[]::"FoodRestrictionTag"[];
