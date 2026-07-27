# Specialized AI Nutrition Agent

The AI Nutrition Agent creates a structured daily food plan after the deterministic Nutrition Engine has calculated calories, macros, safety status, and day type.

## Boundary

- `NutritionTargetsService` remains the numeric source of truth.
- The AI Nutrition Agent must not calculate or override target calories, protein, carbs, or fat.
- The agent may choose meals, ingredients, portions, preparation notes, and display-only substitutions inside the deterministic target.
- For every ingredient, the agent returns only an approved catalog slug, a gram quantity, and whether it is optional. The backend resolves the localized name, assigns its recipe role and measurement guidance, and recalculates every ingredient, meal, and day nutrition value.
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
- backend-owned ingredient role, measurement state, preparation guidance, and usage guidance for new catalog-backed plans

Legacy `nutrition.meals` remains readable and is still present for backward compatibility.

## Food variety

Preferred foods are positive hints, not a request to include the same food every day. Before selecting the compact catalog shortlist, `FoodRotationContextService` summarizes the previous 14 local dates from the user's saved plans. It retains only catalog slugs, occurrence counts, distinct days used, last-used date, and days since last use.

Recently repeated foods receive a deterministic soft ranking penalty. This encourages variety in main proteins, meal bases, and other catalog roles while preserving safety and practicality:

- allergies, excluded foods, and diet compatibility remain hard filters;
- foods explicitly marked available today outrank rotation;
- a safe unused alternative may outrank a recently repeated preferred food;
- preferred foods remain useful after the rotation penalty has cooled;
- rotation never changes the fixed calorie or macro target and never causes a plan to fail by itself.

The model receives only the compact usage summary, not previous plan content, user IDs, profile records, or private notes.

## Ingredient clarity

The backend derives each catalog ingredient's purpose from its approved recipe-template role. The model does not decide whether an item is a main component, base, side, or cooking fat. The backend also derives a conservative measurement state from curated catalog identity and preparation metadata.

Meal Details can therefore explain both amount and use. An entry such as `Olive oil · 15 g` is accompanied by `For cooking` and guidance that the measured amount is used during cooking or as dressing and is already included in nutrition totals. If raw/cooked state is not certain, the backend uses `AS_LISTED` rather than inventing certainty.

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

## AI proposal-first planning

When `AI_PROVIDER=openai`, a new plan and a full-menu regeneration use an
AI proposal-first path. OpenAI chooses the complete menu structure, allowed catalog
food slugs, quantities, and user-facing meal copy from a compact, pre-filtered
catalog shortlist and compatible recipe templates. It receives the fixed target,
training-day context, goal, preferences, availability hints, and safety constraints.

The model is the meal planner, but it is not the numeric or safety authority. The
backend resolves catalog nutrition, recalculates all meal and day totals, performs
bounded portion solving and safe rebalancing, validates the complete result, and
issues one validator-guided retry when necessary. A deterministic catalog fallback
remains the last safety net if a valid plan cannot be produced.

Local `AI_PROVIDER=mock` mode intentionally stays catalog-first. It produces
deterministic, catalog-backed plans for development and QA without external calls.
Focused single-meal regeneration also stays controlled and deterministic until it
has a bounded AI proposal flow that can prove unaffected meals remain unchanged.

Current tolerances:

- calories: within 5% or 100 kcal, whichever is larger
- protein: within 10 g or 10%
- carbs: within 15 g or 12%
- fat: within 10 g or 12%
- meal arithmetic: small rounding tolerance

## Retry And Fallback

OpenAI nutrition generation has one retry when deterministic validation fails.

### Validator-guided retry

The retry is a complete regenerated plan, not a partial patch. Before issuing it,
`FoodPlanValidationService` produces a bounded repair brief containing only safe,
calculated planning data:

- validation reason codes
- fixed backend target totals
- recalculated candidate totals and target delta when a valid draft exists
- affected meal IDs
- concise correction instructions

The OpenAI request receives that brief so it can correct the exact mismatch, such
as portion totals or macro fit, without being allowed to change the target,
restrictions, or catalog boundary. Logs record reason codes, affected-meal count,
and whether a calculated delta exists; they never record full plans, health notes,
or raw profile data.

This is a transition toward an AI-first planning flow. The current catalog-first
composer remains the preferred safe source when it can already meet the fixed
target; the backend still validates every result and retains deterministic fallback
as the final safety net.

If retry fails, the backend stores a deterministic fallback food plan. The fallback:

- uses the deterministic target when available
- avoids complex recipes
- avoids medical claims and restrictive language
- uses the selected plan locale for meal labels, preparation guidance, serving summaries, and substitution copy
- marks `source=DETERMINISTIC_FALLBACK`
- includes safe validation reasons for UI and diagnostics

## Food-plan regeneration

The Nutrition Agent also supports two focused regeneration modes:

- `FULL_MENU_REGENERATION`: replace the complete food plan while preserving the saved `nutritionTargetSnapshot`. In OpenAI mode, the backend derives a stable variation seed from the stored ingredients and asks AI for a new complete proposal from the safe catalog shortlist and compatible templates. It then recalculates, solves, validates, and may issue one validator-guided repair retry. In mock mode, the backend composes the next safe deterministic catalog variation.
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
