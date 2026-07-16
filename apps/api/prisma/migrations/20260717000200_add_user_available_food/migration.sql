-- User-confirmed catalog foods available for a single local day.
-- This deliberately models availability, not food-storage safety or inventory quantities.
CREATE TABLE "UserAvailableFood" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foodCatalogItemId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAvailableFood_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAvailableFood_userId_foodCatalogItemId_localDate_key"
  ON "UserAvailableFood"("userId", "foodCatalogItemId", "localDate");
CREATE INDEX "UserAvailableFood_userId_localDate_idx"
  ON "UserAvailableFood"("userId", "localDate");
CREATE INDEX "UserAvailableFood_foodCatalogItemId_idx"
  ON "UserAvailableFood"("foodCatalogItemId");

ALTER TABLE "UserAvailableFood"
  ADD CONSTRAINT "UserAvailableFood_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAvailableFood"
  ADD CONSTRAINT "UserAvailableFood_foodCatalogItemId_fkey"
  FOREIGN KEY ("foodCatalogItemId") REFERENCES "FoodCatalogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
