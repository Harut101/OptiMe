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

## Phase 6: Controlled USDA import and curation foundation - complete

- Added a local JSON importer for official FoodData Central exports.
- Default scope accepts Foundation records and validates required per-100 g nutrients.
- Imports are idempotent by USDA FDC ID and preserve manually reviewed active rows.
- Imported records remain inactive until a future catalog-curation workflow reviews safety tags, diet suitability, and localization.
- Added a manifest-driven curation script that requires all supported locales, diet suitability, and restriction tags before activating an imported item.
- The importer is tooling only: no mobile, API request, or daily-plan generation path calls USDA.

Exit criteria: USDA data can be evaluated, reviewed, and stored locally without making unreviewed data available to users. Met.

## Phase 7: Recipe template guidance - complete

- Added one shared deterministic recipe-template source for the Nutrition Agent and catalog-backed fallback.
- OpenAI receives only usable diet-aware meal patterns after catalog restriction filtering.
- Each AI meal selects an allowed internal template ID; the backend verifies it before resolving catalog ingredients.
- Template guidance improves meal structure without trusting AI for nutrition arithmetic or exposing implementation details to mobile.

Exit criteria: AI generation and deterministic fallback use the same meal-role patterns, so a future template change cannot silently make the two paths diverge. Met.

## Phase 8: Deterministic recipe composition - complete

- Added `FoodPlanRecipeComposerService` as the primary catalog-backed ingredient and portion composition path for new daily plans.
- The composer runs before OpenAI and is used only when its fixed-target plan passes deterministic validation.
- Added a separate structured-output contract for AI meal copy: titles, summaries, preparation time, and preparation steps only.
- If AI copy fails or introduces unsafe language, the validated deterministic meal plan remains available without changing its nutrition values.
- Full-menu regeneration derives a stable variation seed from the saved menu, selects a different safe catalog variant, and runs the deterministic portion solver plus catalog rebalancer before AI meal copy.
- Individual-meal regeneration retains its current controlled ingredient-selection path until it has a bounded single-meal solver that can preserve every unaffected meal exactly.

Exit criteria: a temporary OpenAI copy failure cannot prevent a user from receiving a complete, safe, target-aligned primary food plan. Met.

## Phase 9: Deterministic focused meal regeneration - complete

- Added a bounded portion-solver mode that may adjust quantities only in explicitly selected meal IDs.
- Meal regeneration composes a catalog-backed alternative using a stable seed derived from the selected stored meal.
- The replacement is merged with the current food plan before validation; every unselected meal, its ID, and its tracking association remain unchanged.
- When OpenAI mode is enabled, AI receives only the selected meal ID, type, and already-approved ingredient names to improve its user-facing copy; it cannot regenerate the full day or alter nutrition values.
- If the replacement cannot meet the saved target safely, regeneration fails without writing any replacement and the current plan remains intact.

Exit criteria: a user can replace one meal with a different safe catalog meal without changing the rest of the day. Met with e2e coverage.

## Phase 10: Catalog-first mock parity - complete

- Mock-mode initial plans now run the same deterministic catalog composition, portion solving, rebalancing, and validation path as production generation.
- This keeps local development and QA aligned with the user-facing production meal structure while avoiding any external AI request.
- The legacy deterministic mock plan remains only as a safe fallback when catalog composition cannot meet a user's restrictions or target.

Exit criteria: a standard mock-generated plan persists catalog-backed ingredient slugs and validates against the same food-plan contract. Met with e2e coverage.

## Phase 11: Practicality preferences - complete

- A saved progressive-profile `Very quick` cooking-time answer is passed into every Nutrition Agent generation and food regeneration path.
- It softly prioritizes ready-to-eat and quick-assembly catalog candidates across meal roles for every tier.
- Preference matches, dietary restrictions, allergy blocks, nutrition targets, and portion solving remain authoritative.
- Other cooking-time answers keep the normal balanced ranking until OptiMe can model an actual batch-prepared inventory instead of assuming one exists.

Exit criteria: the app's explicit cooking-time question changes catalog selection without weakening safety or fabricating preparation state. Met with focused E2E coverage.

## Phase 12: Meal-timing preference - complete

- A saved `Earlier meals` or `Later meals` progressive-profile answer reaches initial generation and both food-regeneration paths.
- The deterministic composer modestly weights the starting breakfast/lunch/dinner portions earlier or later, then the existing portion solver restores the exact daily target.
- This is a broad distribution preference, not a time-of-day prescription or a replacement for workout-fueling rules.
- `Evenly spaced` and `Flexible` retain the neutral meal distribution.

Exit criteria: meal timing changes the composition starting point while daily nutrition targets, safety, and catalog restrictions remain fixed. Met with focused E2E coverage.

## Phase 13: Confirmed available foods foundation - complete

- Add a user-owned, local-date-scoped list of catalog foods confirmed as available today.
- Validate every saved item against active catalog status plus current diet and restriction filtering.
- Softly rank confirmed items during deterministic composition without treating them as quantities, storage guidance, or a guaranteed menu inclusion.
- Food now has a compact localized Bottom Sheet that loads only safe candidates and saves the user's current local-date choices.

## Deferred

- Branded products and barcode lookup.
- User-created recipes and recipe imports.
- Food photo recognition.
- Scheduled USDA source updates and admin-only curation UI.
- Regional retail product coverage.

These are valuable, but they should follow a stable generic-food and recipe-template foundation.
