# Food Catalog Implementation Plan

## Product outcome

Every generation returns a complete safe daily plan. AI improves variety and explanations, while OptiMe owns nutrition calculations, dietary restrictions, and recovery behavior.

## Phase 1: Catalog foundation - complete

- FoodCatalogItem and FoodCatalogTranslation Prisma models.
- Curated generic food seed with source provenance.
- Four supported locales and aliases.
- Safe candidate filtering and per-100 g nutrition calculation.

Exit criteria: migration applies, catalog validates, and the seed is repeatable. Met with 80 curated generic foods and 320 localized translation rows.

## Phase 2: Catalog-backed deterministic meals - complete

- Add optional `catalogFoodId` to a food-plan ingredient.
- Replace placeholder fallback ingredients with composed meals using catalog items.
- Calculate each ingredient, meal, and day from catalog values.
- Preserve a complete meal plan when the Nutrition Agent cannot return valid output.

Exit criteria: a nutrition-agent failure still returns breakfast, lunch, dinner, ingredients, portions, and coherent totals. Met with the catalog-backed fallback service and regression coverage.

## Phase 3: AI selection with backend-owned numbers - complete

- Filter allowed candidates before requesting AI using allergies, excluded foods, disliked foods, diet type, and preferences.
- Ask AI for catalog IDs, grams, meal grouping, preparation, and substitutions only.
- Resolve IDs and recalculate totals on the backend.
- Reject unknown IDs without treating the entire daily plan as unusable.

Exit criteria: AI cannot introduce an unknown or restricted ingredient, and macro arithmetic is backend-owned. Met for the curated catalog: AI provides allowed slugs and grams; backend recalculates nutrition fields.

## Phase 4: Section-level reliability - complete

- Keep a valid daily-plan shell before any AI call.
- Replace only a failed food, training, or explanation section.
- Persist `READY` when the user receives a complete validated plan; retain internal provenance for deterministic adjustments.
- Track section-level failure rates in AiOperationLog-safe metadata.

The DailyPlan debug contract records whether the persisted plan is complete and which sections were safely adjusted. A complete validated plan persists as `READY`; internal provenance remains in `plan.debug` and `AiOperationLog`, rather than appearing as a user-facing failure. Mobile continues to render the complete plan without technical fallback language.

Exit criteria: one malformed AI section never removes the user's full plan. Met: safe replacement sections preserve a complete plan and user-facing `READY` status.

## Safety hardening - complete before Phase 4

- Catalog restriction tags identify common allergen and dietary-risk groups.
- Multilingual synonym mapping filters tagged foods before the AI receives candidates.
- Final deterministic SafetyService validation remains in place after generation.

## Phase 5: Curated variety and deterministic recipe templates - complete

- Expanded the generic catalog from 24 to 80 commonly available foods.
- Added new tagged dairy, fish, shellfish, soy, peanut, tree-nut, sesame, wheat, and gluten entries.
- Expanded fallback templates across standard, pescatarian, vegetarian, vegan, and low-carb patterns.
- Rotate allowed alternatives deterministically by plan local date while keeping all nutrition calculations backend-owned.

Exit criteria: safe fallback plans can use a broader catalog without random choices, free-text food invention, or bypassing restrictions. Met.

## Deferred

- Branded products and barcode lookup.
- User-created recipes and recipe imports.
- Food photo recognition.
- Full USDA import pipeline and scheduled source updates.
- Regional retail product coverage.

These are valuable, but they should follow a stable generic-food and recipe-template foundation.
