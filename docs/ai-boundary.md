# AI Boundary

OptiMe keeps AI behind the NestJS backend. The mobile app never calls OpenAI directly and never stores OpenAI keys.

## Daily Plan AI Stages

- `AiProvider` creates the general `DailyPlanJson` shell.
- `NutritionTargetsService` calculates deterministic calories and macros before meal generation.
- `NutritionAgentService` acts as the specialized AI Nutrition Agent when `AI_PROVIDER=openai`.
- `FoodPlanValidationService` deterministically validates the Nutrition Agent output.
- `TrainingPlanAgentService` selects allowed library candidates, validates the
  generated workout and its duration budget, permits one bounded repair attempt,
  and composes a trusted library fallback when needed.
- `SafetyService` enforces hard safety rules.
- `SafetyAgent` performs final semantic review when enabled.

## Nutrition Agent Boundary

The AI Nutrition Agent may generate:

- meal titles and meal types
- ingredients and portions
- per-meal calories/macros
- preparation steps
- display-only substitutions
- localized meal explanations

It must not generate or override:

- daily calorie target
- daily protein/carbs/fat targets
- safety status
- subscription entitlements
- usage limits
- medical diagnosis

The deterministic Nutrition Engine remains the numeric source of truth.

## Training Agent Boundary

The AI may choose and prescribe exercises only from the candidates supplied by
`TrainingPlanAgentService` and `ExerciseSelectionService`. The backend remains
authoritative for exercise identity, equipment eligibility, pain and limitation
filtering, target duration, volume bounds, and immutable localized exercise
snapshots.

Invalid identities, prescriptions, rest intervals, or session duration trigger
at most one repair request. A failed repair is replaced with a deterministic
workout made only from trusted `ExerciseLibrary` records.

## Regeneration Boundary

Meal and full-menu regeneration reuse the same AI boundary as normal structured food-plan creation:

```txt
stored nutritionTargetSnapshot
+ food preferences
+ current foodPlan context
+ regeneration mode
-> NutritionAgentService
-> FoodPlanValidationService
-> SafetyService / SafetyAgent
-> update only DailyPlan.planJson.nutrition.foodPlan
```

The AI Nutrition Agent may propose replacement meal content, but it must not change target calories, macros, app mode, training plan, recovery guidance, reminders, exercise selection, usage limits, or subscription state.

Regeneration logs must remain metadata-only. Do not log raw prompts, OpenAI responses, API keys, auth tokens, full profile payloads, or full meal text.
