# Food Tracking Mobile QA

Use a physical device or simulator with the API reachable from the mobile app.

## Happy Path

1. Register or log in.
2. Complete onboarding.
3. Generate a daily plan with a structured food plan.
4. Open the Food tab.
5. Confirm the meal plan is visible.
6. Confirm Food Progress shows `0 of N meals marked`.
7. Mark one meal as eaten.
8. Confirm Food Progress updates to `1 of N meals marked`.
9. Open Meal Details.
10. Change the same meal to partially eaten.
11. Return to Food and Today.
12. Confirm the summary reflects the updated status.

## Status Changes

- Mark a meal as eaten.
- Mark it as partially eaten.
- Mark it as skipped.
- Reset it to planned.
- Confirm each action keeps the meal visible and does not clear the plan.

## Today Screen

- Today shows a compact food progress summary when structured meals exist.
- Today does not show meal-level controls.
- Pull-to-refresh refreshes Today, usage, workout status, progressive prompts, and food progress.

## Meal Details

- Meal Details shows the current meal status.
- Meal Details offers status actions.
- Meal regeneration still works.
- Excluding an ingredient still works.

## Compatibility

- Old plans without `nutrition.foodPlan` should not crash.
- Old plans should not show meal tracking controls.
- Full menu regeneration preserves matching meal ids and resets replaced meal ids.

## Safety Copy

- No copy should shame skipped or partial meals.
- Error copy should keep the visible plan in place.
