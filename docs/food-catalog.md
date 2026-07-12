# Food Catalog Foundation

## Purpose

The Food Catalog is the backend source of truth for ingredient nutrition data. It will let OptiMe calculate meal totals deterministically instead of trusting calories and macros generated as free text by an AI model.

The catalog does not replace AI. The Nutrition Agent will eventually select practical ingredient combinations from safe catalog candidates; the backend will calculate their nutrition values and enforce user restrictions.

## Current batch

The first batch adds a curated generic-food catalog with 24 commonly used foods and translations for `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`.

It includes:

- canonical slug and localized names/aliases;
- calories, protein, carbohydrates, fat, and optional fiber per 100 g;
- broad category and diet suitability metadata;
- a service to list candidates after applying exact allergy, excluded-food, and disliked-food filters;
- a service to calculate nutrition from a catalog item and a gram amount.

The catalog is currently used for Nutrition Agent ingredient selection and deterministic food-plan fallback. Existing legacy plans remain readable because `catalogFoodSlug` is optional in the shared plan contract.

## Current generation behavior

When the OpenAI Nutrition Agent is enabled, it receives only the allowed catalog candidates for the user. It must return a `catalogFoodSlug` and a gram quantity for every ingredient.

The backend then resolves each slug, replaces the display name with the catalog translation, and recalculates ingredient, meal, and day totals from catalog values. Unknown slugs or non-gram units are rejected and can trigger the existing single retry. This removes AI arithmetic as the source of meal-total mismatches.

If the Nutrition Agent cannot provide a valid catalog-backed menu after its retry, OptiMe composes a complete deterministic fallback menu from allowed catalog foods. The current placeholder fallback remains only for the exceptional case where the user restrictions leave too few safe catalog candidates.

## Data sources

The initial entries are curated generic references. Future imports may use USDA FoodData Central for generic foods. Source provenance is stored per catalog item so a later import can retain its original identifier without replacing curated data.

Do not use Open Food Facts data in the primary catalog without a separate licensing and data-quality review.

## Commands

After applying the Prisma migration and generating Prisma Client:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:validate
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:seed
```

## Next implementation steps

1. Add richer allergen tags and synonym mapping for catalog safety filters.
2. Add section-level provenance to distinguish AI and deterministic food sections without exposing technical internals in the mobile UI.
3. Treat a failed food section as a section-level safe adjustment, not a missing daily plan.
4. Add a controlled USDA import pipeline after the catalog-backed daily-plan loop is stable.
