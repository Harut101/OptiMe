# Specialized AI Nutrition Agent

The AI Nutrition Agent creates a structured daily food plan after the deterministic Nutrition Engine has calculated calories, macros, safety status, and day type.

## Boundary

- `NutritionTargetsService` remains the numeric source of truth.
- The AI Nutrition Agent must not calculate or override target calories, protein, carbs, or fat.
- The agent may choose meals, ingredients, portions, preparation notes, and display-only substitutions inside the deterministic target.
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
