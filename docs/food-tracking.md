# Food Tracking / Meal Completion MVP

Food Tracking lets a user mark planned structured meals as completed, partially completed, skipped, or planned again. It is intentionally lightweight: it records completion state only and does not ask for calories, grams, photos, or replacements.

## Scope

- Works with `DailyPlanJson.nutrition.foodPlan.meals`.
- Stores progress separately from `DailyPlan.planJson`.
- Keeps old text-only plans readable without crashing.
- Keeps meal regeneration and full-menu regeneration compatible with progress sync.
- Does not infer adherence, shame the user, or treat skipped meals as failure.

## Backend Model

`FoodDayLog` is one row per `userId + dailyPlanId`.

`FoodMealProgress` is one row per planned structured meal inside a food day log.

Statuses:

- `PLANNED`
- `EATEN`
- `PARTIALLY_EATEN`
- `SKIPPED`

Counts are denormalized on `FoodDayLog` for simple mobile summaries:

- `plannedMealCount`
- `completedMealCount`
- `partialMealCount`
- `skippedMealCount`

## API

`GET /v1/daily-plans/:dailyPlanId/food-log`

Returns a planned, unpersisted response if the plan has structured meals but no log yet. This avoids creating records just because the user opened the screen.

`POST /v1/daily-plans/:dailyPlanId/food-log/meals/:mealId/status`

Creates or updates meal progress for the authenticated user's own plan. Invalid meal ids and old text-only plans return safe client errors.

## Regeneration Compatibility

Food progress is keyed by stable `meal.id`.

If a regenerated plan keeps a meal id, its status is preserved and the title/type snapshot is refreshed.

If a regenerated plan replaces a meal id, the old progress row is removed and the new meal starts as `PLANNED`.

## Privacy And Safety

Logs store only safe metadata:

- dailyPlanId
- mealId
- old/new status
- aggregate counts

Do not log full meals, profile data, prompts, private notes, or raw `DailyPlanJson`.

## Deferred

- Custom food logging.
- Portion edits.
- Calorie tracking.
- Photo logging.
- Meal swap analytics.
- AI adaptation from food completion history.
