# Deterministic Nutrition Targets

OptiMe calculates daily calories and macros in the backend before AI generation. The AI provider may explain, format, and build meals around these values, but it must not invent or override calorie and macro targets.

## Source Of Truth

- `NutritionTargetsService` is the deterministic source of truth.
- `GET /v1/nutrition-targets/preview?date=YYYY-MM-DD` returns the current calculated target without creating a DailyPlan.
- `DailyPlansService` calculates the target before calling `AiProvider`.
- Generated plans store an immutable `plan.nutritionTargetSnapshot` inside `DailyPlan.planJson`.
- Old plans without `nutritionTargetSnapshot` remain valid.

## Explanation Contract

The backend returns explanation codes and safe params, not localized UI prose:

```ts
{
  titleCode: "TODAY_TARGET" | "MORE_INFO_NEEDED";
  reasonCodes: Array<{
    code: NutritionTargetReasonCode;
    params?: {
      primaryGoal?: PrimaryGoal;
      appMode?: AppMode;
      dayType?: NutritionDayType;
      durationMinutes?: number;
      targetKcal?: number;
      minKcal?: number;
      maxKcal?: number;
      proteinGrams?: number;
      carbsGrams?: number;
      fatGrams?: number;
      missingFields?: NutritionTargetMissingField[];
    };
  }>;
}
```

Mobile owns localized explanation text for `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`. The backend remains the source of numeric truth only.

Legacy `title` and `bullets` are supported only for older saved DailyPlan snapshots. New preview responses and new snapshots should use `titleCode` and `reasonCodes`.

## Day Types

- `NUTRITION_ONLY`: app mode is nutrition-only; workout energy is not added.
- `TRAINING_DAY`: training mode is active and the resolved schedule marks the date as a training day.
- `REST_DAY`: training mode is active, but the resolved schedule marks the date as rest.
- `TRAINING_DISABLED`: training is disabled for the user.

## Safety Behavior

- Missing profile basics returns `NEEDS_MORE_INFO` and zero targets instead of fake values.
- Under-18 users, safe mode, pregnancy, postpartum, and breastfeeding contexts use `LIMITED` targets.
- `LIMITED` targets avoid aggressive deficits.
- Safety is not paywalled and does not depend on plan tier.

## AI Boundary

The OpenAI provider receives `personalizationContext.nutritionTarget` and must align nutrition copy with it. If the target is `NEEDS_MORE_INFO`, AI should avoid exact calorie/macro claims and use supportive guidance.

The Specialized AI Nutrition Agent receives the same deterministic target and creates meals inside that target. It must not decide daily calories or macros. `FoodPlanValidationService` validates the generated food plan against the Nutrition Engine target before the final Safety Agent review.

## Mobile Rendering

The mobile app renders a summary card on Today and Food:

- kcal target when available
- protein/carbs/fat grams
- day type
- safety status
- collapsible explanation
- localized reason-code explanations

The app prefers saved `DailyPlan.plan.nutritionTargetSnapshot` when rendering an existing plan, so old plans do not silently change when profile or schedule data changes later.

Missing profile fields are sent as safe identifiers such as `heightCm` and `weightKg`. Mobile maps those identifiers to localized labels and must not render raw DTO field names.

## Wearable Context Boundary

`NutritionTargetsService` may receive `wearableContext` as part of the calculated target context. In this foundation batch, wearable data does not aggressively change calorie or macro formulas.

Allowed behavior:

- keep nutrition targets steady when recent sleep/recovery signals suggest caution
- attach safe context to `NutritionTarget.context`
- add conservative warnings when wearable data is stale or recovery-oriented

Not allowed:

- large calorie changes based only on wearable data
- medical interpretation of HRV, resting heart rate, or respiratory rate
- overriding user goal, app mode, or deterministic safety rules
