# Goals

OptiMe currently stores one `Goal` per user. The supported direction is one of `HEALTHY_LIFESTYLE`, `IMPROVE_FITNESS`, `BUILD_MUSCLE`, `IMPROVE_ENDURANCE`, or `REDUCE_WEIGHT`. Weight-loss goals may also contain target weight, timeline, and whether changes affect nutrition only or nutrition and training.

There is no multiple-goal array, priority, or primary-goal model. Goal enum identities remain language-neutral; user-facing labels are centralized in `GoalsForm` for later localization.

`GoalsForm` is a controlled, route-free component shared by onboarding and the standalone editor at Profile → Personal → Goals. Wrappers own validation, API persistence, navigation, dirty-state protection, and success/error presentation.

The authenticated domain API is `GET /v1/goals` and `PUT /v1/goals`. A missing goal returns `null` and can be created later without restarting onboarding. The current Stage 1 product contract still requires a goal before first-plan generation.

Saving a goal updates future planning context only. It does not regenerate the current plan, alter historical plans, or delete plan data.
## Localization

Onboarding and standalone goal editing reuse `GoalsForm` and centralized `GoalType`/impact labels. Target weight follows the selected measurement system while the saved request remains kilograms. Safety validation displays localized supportive fallback copy without changing backend rules.
