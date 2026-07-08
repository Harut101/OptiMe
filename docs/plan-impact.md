# Plan Impact And Regeneration Prompt Foundation

Plan Impact is a read-only evaluation layer that helps OptiMe decide whether a saved change may affect the current daily plan.

It does not regenerate plans automatically, does not consume usage, and does not mutate `DailyPlan`. It returns prompt metadata so mobile can let the user choose between:

- `Update today's plan`
- `Apply to future plans only`

## Backend Contract

Endpoint:

```text
POST /v1/plan-impact/evaluate
```

Request:

```json
{
  "changeTypes": ["PROFILE_WEIGHT_CHANGED"],
  "localDate": "2026-07-08",
  "changedFields": ["weightKg"],
  "newValues": {
    "excludedFoods": ["avocado"]
  }
}
```

Response:

```json
{
  "affectsCurrentPlan": true,
  "affectedSections": ["NUTRITION_TARGET", "FOOD_PLAN"],
  "severity": "MEDIUM",
  "changeTypes": ["PROFILE_WEIGHT_CHANGED"],
  "currentDailyPlanId": "daily_plan_id",
  "currentPlanLocalDate": "2026-07-08",
  "deterministicUpdateAvailable": true,
  "aiRegenerationRecommended": true,
  "aiRegenerationRequiredForFullUpdate": true,
  "safetyCritical": false,
  "safetyActionsRequired": [],
  "entitlementFeatureKey": "DAILY_PLAN_REFRESH",
  "usageCost": 1,
  "reasonCodes": ["WEIGHT_CAN_AFFECT_NUTRITION"],
  "prompt": {
    "titleCode": "UPDATE_TODAY_NUTRITION",
    "messageCode": "WEIGHT_CAN_AFFECT_NUTRITION",
    "primaryAction": "UPDATE_TODAY_PLAN",
    "secondaryAction": "APPLY_TO_FUTURE_ONLY",
    "requiresAiGeneration": true,
    "usageCost": 1,
    "safetyCritical": false
  }
}
```

If no current plan exists for `localDate`, the endpoint returns `affectsCurrentPlan=false` and `prompt=null`.

## Change Types

Current supported change types include:

- `PROFILE_WEIGHT_CHANGED`
- `PRIMARY_GOAL_CHANGED`
- `APP_MODE_CHANGED`
- `FOOD_PREFERENCES_CHANGED`
- `ALLERGY_CHANGED`
- `EXCLUDED_FOOD_CHANGED`
- `DISLIKED_FOOD_CHANGED`
- `MEAL_COUNT_CHANGED`
- `TRAINING_ROUTINE_CHANGED`
- `DAILY_TRAINING_OVERRIDE_CHANGED`
- `TRAINING_DURATION_CHANGED`
- `TRAINING_EQUIPMENT_CHANGED`
- `TRAINING_MUSCLES_CHANGED`
- `APPLE_HEALTH_SYNCED`
- `WEARABLE_SNAPSHOT_CHANGED`
- `PRE_WORKOUT_PAIN_LIMITATION`
- `PAIN_AWARE_REPLACEMENT_APPLIED`

## Safety Behavior

Safety is never paywalled.

The service performs lightweight deterministic checks against the current plan. For example, if a user adds `avocado` to excluded foods and the current plan contains `Avocado toast`, the impact result becomes `SAFETY_CRITICAL` with `RESTRICTED_FOOD_IN_CURRENT_PLAN`.

This does not replace deterministic `SafetyService`. The daily plan generation pipeline still owns full schema validation, deterministic safety, AI Safety Agent review, and fallback behavior.

## Usage Behavior

Plan Impact evaluation does not consume usage.

When `aiRegenerationRecommended=true`, the response includes:

- `entitlementFeatureKey: DAILY_PLAN_REFRESH`
- `usageCost: 1`

The actual usage guard remains in the existing DailyPlan refresh endpoint. If the user chooses `Update today's plan`, mobile calls the existing regenerate path and handles `USAGE_LIMIT_REACHED` with existing friendly UX.

`Apply to future plans only` is always available and never consumes usage.

## Mobile Behavior

Mobile renders a reusable `PlanImpactPromptCard` after successful saves/syncs in these flows:

- Today weight update
- Goal editor
- Food preferences
- Training preferences / Weekly Routine
- Health data sync and mock health snapshot

The card is intentionally non-blocking. Existing plans remain visible, and failed impact evaluation does not undo the saved change.

Food-specific rule: preference changes, allergy changes, excluded foods, disliked foods, and meal-count changes should use `PlanImpactPromptCard` when the backend reports that today's plan may be affected. Meal/menu regeneration success can use compact feedback, but safety-critical food changes should never be reduced to a generic toast.

## Deferred

- Automatic deterministic partial updates to an existing `DailyPlan`.
- Dedicated per-section regeneration endpoint from Plan Impact.
- Safety-critical prompt integration inside every workout pain flow.
- Server-side push notifications for stale plans.
