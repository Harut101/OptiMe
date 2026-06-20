# Onboarding

Stage 1 remains a short path to the first safe plan: personal safety context, goal, allergy confirmation, and either a basic schedule or no-training intent. Food and training details can be refined later in their standalone tabs.

Onboarding and standalone pages share controlled domain forms:

- `FoodPreferencesForm` is used by the nutrition onboarding step and Food tab.
- `TrainingSetupForm` is used by the optional training-preference onboarding step and Training tab.
- `PersonalProfileForm` is used by profile onboarding and Profile > Personal.
- `GoalsForm` is used by goal onboarding and Profile > Personal > Goals.

The reusable forms contain no route navigation or API persistence. Wrappers decide whether successful save continues onboarding, returns to Training, or remains in an editor.

Skipping optional setup never forces onboarding to restart. Missing personalization uses safe defaults, while safety-critical allergy, age, and pregnancy/postpartum behavior remains enforced by the backend.

The current Stage 1 contract requires one goal before first-plan generation, so goal onboarding has Continue rather than Skip. The standalone editor still handles a missing goal safely and lets the user create it later without returning to onboarding.
## Localization

Stage 1 onboarding and optional progressive setup use the same translated field components as standalone editors. Prompt copy is selected from stable progressive-prompt keys on mobile; answer values sent to the API remain unchanged. Switching language does not restart onboarding or clear draft values.
