# Weight Tracking

OptiMe stores user weight as sensitive wellness context. Copy and UI must stay neutral, practical, and non-shaming.

## Data Model

- `WeightLog` stores weight history per user.
- `weightKg` is canonical and stored in kilograms.
- `source` is `MANUAL`, `APPLE_HEALTH`, `HEALTH_CONNECT`, `WHOOP`, or `GARMIN`.
- Sprint scope implements manual entries only.
- Manual entries upsert one row per `userId + localDate + source`, so correcting today's value updates that day's manual entry instead of creating duplicates.
- `Profile.weightKg` remains the current-weight source used by existing planning services.

## API

- `GET /v1/weight/summary` returns current, target, starting, remaining, progress, source, and safety status.
- `GET /v1/weight/logs?limit=10` returns recent user-owned entries.
- `POST /v1/weight/logs` creates or updates today's manual entry and updates `Profile.weightKg`.

Request body:

```json
{
  "weight": 180,
  "unit": "LB",
  "localDate": "2026-07-08",
  "measuredAt": "2026-07-08T08:30:00.000Z",
  "note": "Optional note"
}
```

The backend converts `LB` to kg, validates a plausible range, and rejects invalid, infinite, or unsafe values.

## Planning Behavior

- Future Nutrition Targets use the updated `Profile.weightKg`.
- Existing `DailyPlan.planJson.nutritionTargetSnapshot` remains immutable.
- Updating weight does not regenerate or mutate old DailyPlans.
- If a user has no weight data, summary returns `NEEDS_MORE_INFO` instead of fake progress.

## Target Weight

Target weight reuses `Goal.targetWeightKg`.

If target weight is missing, mobile shows a gentle “set target” state. Target copy must avoid pressure language such as “behind,” “failed,” “lose faster,” or “catch up.”

## Safety

Under-18 users, safe mode, pregnancy, postpartum, and breastfeeding contexts receive `safetyStatus: LIMITED`. Safety messaging stays supportive and should avoid aggressive target framing.

Safety is never paywalled.

## Mobile

- Today shows a compact Weight Progress card.
- Profile shows a compact Weight Progress hub row and update action. Full historical analysis remains deferred; the backend history endpoint still exists.
- Update Weight explains: “This updates your current weight for future plans. Previous plans will not change.”
- Display units follow user settings; stored values remain kg.
- After a manual update, Profile shows a toast and may show `PlanImpactPromptCard` so the user can refresh today's plan or keep the update for future plans only.

## Garmin Foundation

`GARMIN` is added as a future source in shared health/weight contracts.

Not implemented in this sprint:

- Garmin OAuth
- Garmin API calls
- background sync
- production token storage
- provider-driven weight import
