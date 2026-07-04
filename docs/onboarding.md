# Onboarding

Stage 1 remains a short path to the first safe plan: personal safety context, goal, app mode, activity level, and allergy confirmation. Food details and training details can be refined later in their standalone tabs.

Onboarding and standalone pages share controlled domain forms:

- `FoodPreferencesForm` is used by the nutrition onboarding step and Food tab.
- `TrainingSetupForm` is used by the Training tab only.
- `PersonalProfileForm` is used by profile onboarding and Profile > Personal.
- `GoalsForm` is used by goal onboarding and Profile > Personal > Goals.

The reusable forms contain no route navigation or API persistence. Wrappers decide whether successful save continues onboarding, returns to Training, or remains in an editor.

Skipping optional setup never forces onboarding to restart. Missing personalization uses safe defaults, while safety-critical allergy, age, and pregnancy/postpartum behavior remains enforced by the backend.

Onboarding does not collect preferred training days, weekly routine details, day-specific muscles, environment, equipment, duration, or pain/limitations. Those belong to later surfaces:

- Training Setup handles general training defaults from the Training tab.
- Weekly Routine handles day-by-day training/rest/muscle/equipment/duration setup from the Training tab.
- Pre-workout Check handles pain, limitations, fatigue, and readiness for the current workout only.

When app mode is `NUTRITION_ONLY`, the nutrition onboarding step routes to Today. Training remains off, and the Training tab shows a disabled state with an Enable Training action.

When app mode is `NUTRITION_AND_TRAINING`, the nutrition onboarding step routes to a short optional bridge: Set up weekly routine now, or Skip for now. Skipping keeps training enabled and lets Daily Plan generation use safe default training behavior until the user configures the Training tab.

The current Stage 1 contract requires one goal before first-plan generation, so goal onboarding has Continue rather than Skip. The standalone editor still handles a missing goal safely and lets the user create it later without returning to onboarding.
## Localization

Stage 1 onboarding and optional progressive setup use the same translated field components as standalone editors. Prompt copy is selected from stable progressive-prompt keys on mobile; answer values sent to the API remain unchanged. Switching language does not restart onboarding or clear draft values.

## Screen Boundary

Onboarding should stay short and safety-first. It collects only what is needed for a first safe plan: identity/safety context, goal, app mode, activity level, allergy confirmation, and basic nutrition setup.

Detailed meal preferences, target muscles, equipment, weekly routine, workout execution, pain/limitations, and health-provider connection flows belong after activation in Food, Training, Health Data, or progressive prompts. If optional context is missing, the backend uses safe defaults and asks later instead of blocking the first plan.
