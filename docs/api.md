# API Notes

## Plan Impact

`POST /v1/plan-impact/evaluate`

Evaluates whether a saved change can affect today's current daily plan. This endpoint is authenticated, read-only, and does not consume usage.

Request fields:

- `changeTypes`: one or more stable change codes, for example `PROFILE_WEIGHT_CHANGED`, `PRIMARY_GOAL_CHANGED`, `FOOD_PREFERENCES_CHANGED`, `TRAINING_ROUTINE_CHANGED`, or `APPLE_HEALTH_SYNCED`.
- `localDate`: optional `YYYY-MM-DD`; defaults to the user's current local date.
- `changedFields`: optional field-name hints.
- `newValues`: optional safe values needed for deterministic conflict checks, such as newly excluded foods.

The response includes affected plan sections, severity, safety flags, optional usage metadata for a possible refresh, and localized prompt codes for mobile.

## Workout Sessions

Workout Session endpoints are authenticated and scoped to the current user.

```txt
POST /v1/workout-sessions
GET /v1/workout-sessions/by-plan/:dailyPlanId
GET /v1/workout-sessions/:sessionId
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId/sets
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId
POST /v1/workout-sessions/:sessionId/complete
```

`POST /v1/workout-sessions` is idempotent for `userId + dailyPlanId`. It returns the existing session if one already exists.

Workout Session errors should remain friendly and must not expose raw user IDs, profile data, prompts, tokens, or secrets.

History and summary endpoints:

```txt
GET /v1/workout-sessions/history
GET /v1/workout-sessions/:sessionId/summary
```

History returns completed sessions only, newest first, with safe summary DTOs and cursor pagination. Summary/detail responses must not leak raw `DailyPlan.planJson`.

## Food Tracking Endpoints

`GET /v1/daily-plans/:dailyPlanId/food-log`

Returns food completion progress for the authenticated user's own daily plan. If the plan has no structured `nutrition.foodPlan`, the response is `supported: false`.

`POST /v1/daily-plans/:dailyPlanId/food-log/meals/:mealId/status`

Updates one structured meal status. Supported statuses are `PLANNED`, `EATEN`, `PARTIALLY_EATEN`, and `SKIPPED`.
