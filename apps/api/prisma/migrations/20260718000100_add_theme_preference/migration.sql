CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

ALTER TABLE "UserSettings"
  ADD COLUMN "themePreference" "ThemePreference" NOT NULL DEFAULT 'SYSTEM';
