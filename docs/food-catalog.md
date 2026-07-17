# Food Catalog Foundation

## Purpose

The Food Catalog is the backend source of truth for ingredient nutrition data. It will let OptiMe calculate meal totals deterministically instead of trusting calories and macros generated as free text by an AI model.

The catalog does not replace AI. The Nutrition Agent will eventually select practical ingredient combinations from safe catalog candidates; the backend will calculate their nutrition values and enforce user restrictions.

## Current batch

The current curated generic-food catalog contains 80 commonly available foods and translations for `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`.

It includes:

- canonical slug and localized names/aliases;
- calories, protein, carbohydrates, fat, and optional fiber per 100 g;
- broad category and diet suitability metadata;
- preparation metadata (`READY_TO_EAT`, `QUICK_ASSEMBLY`, or `COOK_REQUIRED`) for future practical-menu selection;
- a service to list candidates after applying exact allergy, excluded-food, and disliked-food filters;
- a service to calculate nutrition from a catalog item and a gram amount.

## Restriction safety

Catalog items carry backend-owned restriction tags. The current curated catalog marks dairy, egg, fish, soy, tree nut, wheat, and gluten ingredients where applicable.

Before an AI request or deterministic fallback is composed, FoodCatalogService maps common allergy and exclusion terms to these tags. The mapping supports the current product locales, including examples such as `milk` / `молоко`, `fish` / `рыба`, `soy` / `соя`, and `nuts` / `орехи`.

This is an additional hard filter; deterministic SafetyService still remains the authority for validating the final plan. Unknown or ambiguous user-entered restrictions are not silently treated as safe catalog matches.

The catalog is currently used for Nutrition Agent ingredient selection and deterministic food-plan fallback. The fallback templates rotate allowed proteins, grains, vegetables, fruits, and fats deterministically by local date, so they provide practical variation without relying on model arithmetic. Existing legacy plans remain readable because `catalogFoodSlug` is optional in the shared plan contract.

Catalog-backed meals use their actual selected ingredient names for the meal title, while `Breakfast`, `Lunch`, `Dinner`, and `Snack` remain structured meal-type labels. This gives Food and Meal Details a useful dish name without letting a model invent ingredients or hiding the products that were selected.

Recipe templates also define a small presentation layer for catalog-backed meals: a bowl, plate, or snack assembly style and an expected preparation time. The backend turns that metadata and the selected safe ingredient names into two short preparation steps. These instructions are intentionally practical and conservative; they never change ingredients, portions, nutrition totals, allergy filters, or the deterministic safety boundary.

Preparation metadata is deliberately conservative. `READY_TO_EAT` means the catalog item can be used without cooking, `QUICK_ASSEMBLY` means it can be combined or reheated without a full cook, and `COOK_REQUIRED` is the default for anything that needs preparation. Curated foods are explicitly classified; unknown and newly imported foods keep the conservative default until reviewed.

For Personalized and Adaptive plans only, two or more tracked skipped meals can softly prioritize ready-to-eat or quick-assembly catalog foods for the most frequently skipped meal type. This is not a hard filter: user preferences and food restrictions still rank first, and the normal safe catalog selection remains available when no practical option exists. It never lowers calorie or macro targets, changes portions to compensate, or exposes an adherence score in the mobile app. Basic plans retain their existing selection behavior.

An explicit progressive-profile answer of `Very quick` also applies the same soft practical ranking across every meal role for all tiers. This makes the stated preference real without paywalling practicality. The `15-30 minutes` and `I can cook longer` answers retain the normal balanced ranking because the current catalog does not yet model a person's pre-cooked batch inventory.

An explicit `Earlier meals` or `Later meals` answer modestly shifts the starting portions toward breakfast or dinner before the existing solver restores the same daily calorie and macro target. It is not an exact eating schedule, does not change training timing, and leaves `Evenly spaced` and `Flexible` neutral. This keeps a timing preference useful without inventing a medical or rigid meal-timing rule.

## Confirmed available foods

The backend supports a small daily availability list through `GET` and `PUT /v1/food-availability/today`. `GET /v1/food-availability/candidates` returns the current user's allowed catalog choices for the mobile picker. After saving choices, Food offers the user a separate decision to refresh today's menu or apply the preference only to future menus; it never refreshes automatically. Availability is scoped to the user's local date, has no quantities or storage claims, and never bypasses food safety. When a list is present, deterministic composition starts from the availability-ranked catalog choices; it may still add other safe catalog foods when the selected list cannot cover a required recipe role or a safe target-aligned menu.

Meal preparation time is also catalog-derived. A meal composed entirely of ready-to-eat ingredients is shown as five minutes with assembly guidance; a meal made of quick-assembly ingredients is capped at ten minutes and may say to warm already-cooked items. Any meal containing a `COOK_REQUIRED` ingredient keeps its template preparation time and preparation guidance.

## Current generation behavior

When the OpenAI Nutrition Agent is enabled, it receives only a compact, allowed catalog shortlist for the user. The backend derives shortlist roles from existing food categories: breakfast base, main protein, carbohydrate, vegetable, fruit, fat, and dairy/alternative. Preference matches are ranked first; remaining safe choices rotate deterministically by local date. This keeps prompts practical without hardcoding menus for each user. The AI output can select only a `catalogFoodSlug`, gram quantity, and optional flag for each ingredient; it cannot supply ingredient names or nutrition values.

The shortlist is not a second source of truth. The full active catalog remains authoritative, and the backend still recalculates nutrition and applies every restriction before a plan is saved. A future recipe-template layer can add finer cooking-state or cuisine metadata if the product needs it.

The backend then resolves each slug, replaces the display name with the catalog translation, and recalculates ingredient, meal, and day totals from catalog values. Unknown slugs or non-gram units are rejected and can trigger the existing single retry. This removes AI arithmetic as the source of meal-total mismatches.

`food-catalog:coverage` audits baseline diets plus common diet-and-restriction bundles, including dairy/fish-free omnivore, egg/soy-free vegetarian, soy/tree-nut-free vegan, gluten-free omnivore, dairy-free low-carb, and dairy/tree-nut-free keto. The report is diagnostic only: `READY` means at least two candidates for every required role, `LIMITED` means a role has one candidate, and `BLOCKED` means a required role has none. Role counts are always shown, including optional roles such as dairy/alternative in a dairy-free bundle. It uses the same catalog restriction filters as daily-plan generation.

If the Nutrition Agent cannot provide a valid catalog-backed menu after its retry, OptiMe composes a complete deterministic fallback menu from allowed catalog foods. Fallback templates describe meal roles and portions only: breakfast base, protein, carbohydrate, vegetables, fruit, fat, and dairy/alternative. The backend selects candidates from the active, restriction-filtered catalog for those roles, so newly reviewed USDA foods can enter fallback menus automatically without adding their slug to application code. Unreviewed USDA imports remain inactive and cannot appear in a fallback menu. The current placeholder fallback remains only for the exceptional case where the user restrictions leave too few safe catalog candidates.

Every newly persisted plan records internal `debug.generation` provenance. It marks the plan as complete and lists only the sections that needed a deterministic safe adjustment. This metadata is not rendered in mobile UI; it supports operations and regression tests without exposing implementation language to users.

## Data sources

The initial entries are curated generic references. A controlled USDA FoodData Central import foundation is available for local, reviewed generic-food snapshots. Source provenance is stored per catalog item so an import retains its original identifier without replacing curated data.

USDA imports are inactive by default and never enter planning until local review assigns translations, diet suitability, and restriction tags. See [USDA Food Import](usda-food-import.md) for the dry-run and apply workflow.

Do not use Open Food Facts data in the primary catalog without a separate licensing and data-quality review.

## Commands

After applying the Prisma migration and generating Prisma Client:

```powershell
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:validate
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:seed

# Check active catalog coverage before or after a USDA curation batch.
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:coverage -- --locale en-US

# Optional, review-first USDA Foundation Foods import.
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api food-catalog:usda:import -- --input "C:\data\FoundationFoods.json" --limit 25
```

## Next implementation steps

Ingredient swap foundation exposes up to three same-category catalog alternatives for a structured plan ingredient. Candidates are filtered by the user's current diet, allergies, excluded foods, and disliked foods. Suggestions are read-only: viewing them never changes the current plan, and applying an alternative remains a separate future action with portion solving and validation.

The coverage audit reports omnivore, vegetarian, vegan, pescatarian, Mediterranean, keto, and low-carb scenarios. A scenario is `READY` when every required meal role has at least two safe candidates, `LIMITED` when a role has only one candidate, and `BLOCKED` when a required role is absent. Mediterranean selection requires explicit Mediterranean catalog metadata. Keto and low-carb selection use conservative catalog-level thresholds of 10 g and 15 g carbohydrates per 100 g respectively; these are selection guardrails, not medical nutrition targets.

Halal and kosher are deliberately excluded from the readiness audit. Generic nutrient data cannot prove certification, source, slaughter method, or preparation compliance. They remain available as preferences until OptiMe has an auditable verified-compliance data source.

1. Add curated recipe-template metadata only when it is needed for a user-visible recipe experience.
2. Add an admin-only catalog-curation workflow to review and activate USDA imports.
3. Add branded products, barcode lookup, and user-created recipes only after source and licensing review.
