# Profile

Profile stores the current personal context used for future planning.

## Current Weight

`Profile.weightKg` remains the current-weight field used by Nutrition Targets. Manual weight tracking writes a `WeightLog` entry and updates `Profile.weightKg` so future previews and generated plans use the latest value.

Historical `DailyPlan.planJson` snapshots are not mutated after profile updates.

## Safety Context

The backend owns `safeMode` and derives age-aware safety from date of birth. Pregnancy, postpartum, and breastfeeding context remain optional but safety-relevant. Weight progress UI must stay neutral in `LIMITED` contexts and must not encourage aggressive change.

## Mobile Profile

Profile is now a settings hub rather than a dashboard duplicate. It shows compact settings-list rows for:

- account and personal profile editing
- goal and app-mode entry point
- food/nutrition entry point
- current weight update and plan-impact prompt
- training dashboard, Weekly Routine, and workout history entry points
- health connection entry point
- plan tier, language/unit settings, support/privacy, and logout

Profile should not duplicate Today progress, meal details, workout execution, nutrition dashboards, or health dashboards. It routes to the owning screen instead.

Profile uses the unified feedback pattern:

- `AppToast` for saved profile, settings, and weight updates.
- `AppFeedbackSheet` for profile/settings save failures.
- `PlanImpactPromptCard` when profile or weight changes may affect today's plan.

Weight updates can also be started from Today, but Profile owns the account/settings context and future-plan impact messaging.

## Profile Visual Design v2

Profile is a settings hub. It should route users to account/profile, goals, weight progress, training setup, health connections, subscription/plan, app settings, support, and privacy/account areas.

The mobile implementation uses stacked hub cards instead of section tabs. Content inside the cards uses compact settings-list rows rather than dense dashboard cards.
