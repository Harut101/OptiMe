# Specialized AI Nutrition Agent

The AI Nutrition Agent creates a structured daily food plan after the deterministic Nutrition Engine has calculated calories, macros, safety status, and day type.

## Boundary

- `NutritionTargetsService` remains the numeric source of truth.
- The AI Nutrition Agent must not calculate or override target calories, protein, carbs, or fat.
- The agent may choose meals, ingredients, portions, preparation notes, and display-only substitutions inside the deterministic target.
- For every ingredient, the agent returns only an approved catalog slug, a gram quantity, and whether it is optional. The backend resolves the localized name and recalculates every ingredient, meal, and day nutrition value.
- Mobile never calls OpenAI directly.
- The agent uses the existing backend OpenAI client factory and Structured Outputs when `AI_PROVIDER=openai`; mock mode stays deterministic.

## Flow

```txt
Profile + preferences + app mode + schedule
-> NutritionTargetsService
-> NutritionAgentService
-> FoodPlanValidationService
-> deterministic fallback when needed
-> DailyPlanJson.nutrition.foodPlan
-> SafetyService
-> SafetyAgent
-> DailyPlan.planJson
```

## Stored Food Plan

New daily plans may include `plan.nutrition.foodPlan`.

The food plan includes:

- source: `NUTRITION_AGENT` or `DETERMINISTIC_FALLBACK`
- local date and locale
- immutable `nutritionTargetSnapshot`
- daily calories/macros
- validation status and safe reason codes
- meals with IDs, meal types, calories/macros, ingredients, preparation steps, and substitutions

Legacy `nutrition.meals` remains readable and is still present for backward compatibility.

## Validation

`FoodPlanValidationService` validates:

- schema structure
- meal IDs
- ingredients and portions
- finite non-negative numeric values
- ingredient sums vs meal totals
- meal sums vs daily totals
- macro calories vs total calories
- daily totals against deterministic Nutrition Engine tolerance
- allergy and excluded-food conflicts
- unsafe diet language
- conservative language for safe mode, minors, pregnancy, postpartum, and breastfeeding contexts

## Deterministic Portion Solver

After the AI selects only safe catalog ingredients and gram quantities, `FoodPlanPortionSolverService` may make a bounded deterministic adjustment to those quantities before validation. It never adds foods, removes foods, changes meal structure, or bypasses allergy/exclusion filters. The solver keeps an adjustment only when it reduces deviation from the backend calorie and macro target. It is disabled when the Nutrition Engine reports `NEEDS_MORE_INFO` or the target is incomplete, so conservative fallback behavior remains unchanged.

When a valid catalog plan still misses only calorie or macro tolerances after portion solving, `FoodPlanCatalogRebalancerService` may test one allowed substitute from the same catalog category, then solve portions again. It keeps a substitute only when it improves target fit and the existing meal title, description, and instructions do not name the original ingredient. It never runs for schema, safety, allergy, exclusion, or arithmetic failures.

The deterministic fallback menu uses separate templates for omnivore, vegetarian, vegan, pescatarian, Mediterranean, and low-carb/keto preferences. Every template is resolved from the already-filtered safe catalog shortlist. If a dairy/alternative or breakfast-base role is unavailable because of a restriction, the fallback uses a narrowly defined safe role alternative instead of inserting a restricted placeholder. It then applies the same bounded portion solver when a complete target is available.

Before an OpenAI request, `FoodPlanCatalogFeasibilityService` classifies the safe shortlist as `FEASIBLE`, `LIMITED`, or `UNAVAILABLE`. It uses `UNAVAILABLE` only for objective catalog failures such as no usable foods, calories, or a required macro source; in that case the request skips OpenAI and returns the safe fallback directly. `LIMITED` remains an AI planning hint rather than a rejection, preventing conservative diagnostics from unnecessarily reducing plan quality.

## Recipe template layer

`FoodPlanRecipeTemplateService` provides the same deterministic meal structures to both the OpenAI planning context and `CatalogFallbackFoodPlanService`. The current set contains diet-aware breakfast, lunch, and dinner patterns for omnivore, vegetarian, vegan, pescatarian, Mediterranean, and low-carb/keto plans, plus deterministic one-, two-, and snack-based meal-count variants.

For an OpenAI request, the backend sends only templates whose required catalog roles have a safe candidate after diet, allergy, exclusion, and dislike filtering. Each model meal must return one allowed `recipeTemplateId`; the backend verifies the ID and meal type, then removes this internal field before storing the public `DailyFoodPlan`. Template IDs are therefore a generation constraint, not mobile UI data.

The template layer does not own food names, quantities, nutrition calculations, or safety. For focused regeneration, the model selects only allowed catalog slugs and gram quantities; the backend still calculates totals, solves portions, validates restrictions, and falls back safely when needed.

## Deterministic recipe composition

For a new daily plan, `FoodPlanRecipeComposerService` first composes ingredients and gram quantities from the restriction-filtered catalog and the shared recipe templates. The existing portion solver then verifies the deterministic candidate against the fixed target. When it is valid, OpenAI no longer selects ingredients, quantities, calories, or macros.

This same catalog-first composition runs in local `AI_PROVIDER=mock` mode. Mock mode therefore remains useful for development and QA: it produces the same catalog-backed ingredient structure and backend-owned nutrition calculations as the production path, without making an external AI request. The older deterministic mock plan is retained only as a safe last-resort fallback when the available catalog cannot satisfy the user's restrictions and target.

Instead, OpenAI receives the locked meal IDs and the safe ingredient names for each composed meal through the `daily_food_plan_copy` structured-output contract. It may return only localized meal titles, short descriptions, serving summaries, preparation time, and preparation steps. The backend merges this copy onto the composed plan and runs the same deterministic food-safety validation again.

If this copy request is unavailable, malformed, or unsafe, OptiMe keeps the complete deterministic plan rather than downgrading the user to an incomplete plan or a user-visible fallback state. Full-menu regeneration uses the same composition path with a stable seed derived from the saved menu, so it can select a different safe catalog variation without changing the saved nutrition target. Individual-meal regeneration retains the previous controlled ingredient-selection path until it has a bounded single-meal solver that preserves unaffected meals exactly.

Current tolerances:

- calories: within 5% or 100 kcal, whichever is larger
- protein: within 10 g or 10%
- carbs: within 15 g or 12%
- fat: within 10 g or 12%
- meal arithmetic: small rounding tolerance

## Retry And Fallback

OpenAI nutrition generation has one retry when deterministic validation fails.

If retry fails, the backend stores a deterministic fallback food plan. The fallback:

- uses the deterministic target when available
- avoids complex recipes
- avoids medical claims and restrictive language
- marks `source=DETERMINISTIC_FALLBACK`
- includes safe validation reasons for UI and diagnostics

## Food-plan regeneration

The Nutrition Agent also supports two focused regeneration modes:

- `FULL_MENU_REGENERATION`: replace the complete food plan while preserving the saved `nutritionTargetSnapshot`. The backend derives a stable variation seed from the stored meal ingredients, composes the next safe catalog option, solves and rebalances portions deterministically, then requests optional AI copy only.
- `MEAL_REGENERATION`: compose a different safe catalog option for the selected meal, then run a bounded portion solve that may change only that meal's ingredient quantities. Every other saved meal is retained exactly so food tracking remains attached to the correct meal IDs.

With `AI_PROVIDER=openai`, a successful single-meal replacement makes one optional `daily_food_plan_copy` request containing only that selected meal's ID, type, and approved ingredient names. AI may improve the title, description, serving summary, preparation time, and preparation steps for that meal only. It never receives authority to change ingredients, quantities, nutrition values, or any other meal.

Regeneration does not call the Nutrition Engine and does not calculate new calorie or macro targets. It reuses the selected Daily Plan's stored `nutritionTargetSnapshot`, current preferences, allergies, excluded foods, disliked foods, locale, and training-day context.

If regeneration fails validation or returns deterministic fallback output, the existing plan is kept unchanged. The backend does not partially write invalid food plans.

## Deferred

This batch does not add:

- ingredient database
- food tracking or meal completion
- barcode scanning
- grocery lists
- meal logging
- restaurant mode
- user-created custom foods
- recipe images
## Pricing And Entitlements

The Nutrition Agent remains available for safe food planning across tiers, but AI-heavy food regeneration is now usage-limited by tier.

- Full menu regeneration uses `MENU_REGENERATION`.
- Individual meal regeneration uses `MEAL_REGENERATION`.
- Over-limit requests are blocked before the Nutrition Agent runs.
- Failed safe-regeneration attempts refund the reserved usage and keep the current plan unchanged.

Nutrition-only users can still receive paid value through deeper food personalization, meal/menu regeneration, food preferences, health-aware nutrition context, and food tracking. Safety checks for allergies, excluded foods, pregnancy/postpartum, minors, and unsafe diet language are not paywalled.
