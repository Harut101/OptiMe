# Nutrition Targets Mobile QA

Use this checklist after changes to deterministic nutrition targets or Today/Food rendering.

## Backend Setup

1. Start Postgres.
2. Run API with normal dev `DATABASE_URL`.
3. Use a user with completed Stage 1 onboarding.

## QA Steps

1. Nutrition-only user:
   - Set app mode to Nutrition only.
   - Generate or refresh Today.
   - Confirm Today shows Nutrition targets.
   - Confirm the card says Nutrition-only day.
   - Confirm training remains off and no workout calories are implied.

2. Training-day user:
   - Enable Nutrition + Training.
   - Add an active weekly schedule with today marked as a training day.
   - Generate or refresh Today.
   - Confirm target card appears and the day type is Training day target.

3. Rest-day user:
   - Keep Nutrition + Training active.
   - Mark today as a rest day in weekly schedule.
   - Confirm the target card says Rest day target.

4. Food tab:
   - Open Food.
   - Confirm the Nutrition targets card appears above preferences.
   - Confirm preference editing still works.

5. Explanation:
   - Tap Why these targets?
   - Confirm explanation expands and collapses.
   - Confirm explanation bullets are localized in the selected app language.
   - Confirm no raw reason codes such as `BASED_ON_PRIMARY_GOAL` are visible.
   - Confirm no raw field names such as `heightCm` or `weightKg` are visible.
   - Confirm no debug fields are visible.

6. Compatibility:
   - Open an older plan without `nutritionTargetSnapshot`.
   - Confirm the app does not crash.
   - Open an older plan with legacy `explanation.title` and `explanation.bullets`.
   - Confirm it still renders without crashing.

7. Safety:
   - Test an under-18 or pregnancy/postpartum context.
   - Confirm target status is conservative/limited and copy remains supportive.
