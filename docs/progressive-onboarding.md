# Progressive Onboarding

Sprint 5 moves onboarding toward a two-stage model:

- Stage 1 collects only the safety-critical basics needed for a first safe daily plan.
- Stage 2 collects personalization details progressively after the user has seen value.

Safety is not reduced by this change. Missing optional personalization uses conservative defaults, while missing safety-critical answers blocks first-plan generation.

## Stage 1 Required Fields

`GET /v1/onboarding/status` now reports `stage1Completed`, `canGenerateFirstPlan`, and `missingStage1Fields`.

Stage 1 requires:

- `privacyConsent`
- `firstName`
- `gender`
- `dateOfBirth`
- `heightCm`
- `weightKg`
- `activityLevel`
- `goalType`
- `targetWeightKg`, `targetTimelineDays`, and `impactMode` when `goalType=REDUCE_WEIGHT`
- `allergyInformation`: at least one allergy or explicit confirmation of no known allergies
- `basicTrainingIntent`: at least one training schedule item or explicit no-training-planned intent

Pregnancy/postpartum context is optional. `UNKNOWN` and `PREFER_NOT_TO_SAY` do not block onboarding; the backend should use conservative safety behavior without making medical claims.

## Allergy Confirmation

Do not silently assume missing allergy data is safe.

Sprint 5 adds `NutritionPreference.noKnownAllergiesConfirmed`.

Stage 1 passes allergy readiness when either:

- the user has at least one `Allergy` row, or
- `noKnownAllergiesConfirmed=true`

When actual allergies are submitted, `noKnownAllergiesConfirmed` is stored as `false` so the record has one clear source of truth.

## Training Intent

Full training schedule completion is no longer required for Stage 1.

Stage 1 passes training readiness when either:

- the user has at least one `TrainingScheduleItem`, or
- `User.noTrainingPlanned=true`

`PUT /v1/training-schedule/intent` accepts:

```json
{
  "noTrainingPlanned": true
}
```

Creating a real training schedule item clears `noTrainingPlanned` automatically.

If no schedule exists but the user explicitly has no training planned, daily plan generation should use conservative movement/recovery guidance.

## Stage 2 Deferred Fields

These fields should not block the first plan:

- `preferredFoods`
- `excludedFoods`
- `dietType`
- `mealsPerDay`
- `targetMuscleGroups`
- `equipment`
- `trainingLevel`
- `limitationsOrPainAreas`
- `cookingTimePreference`
- `mealPrepPreference`
- `mealTimingPreference`

Current safe defaults:

- `dietType=NONE`
- `mealsPerDay=3`
- `preferredFoods=[]`
- `excludedFoods=[]`
- training personalization stays minimal

## Onboarding Status Shape

The endpoint keeps older fields for mobile compatibility and adds the progressive model:

```json
{
  "profileCompleted": true,
  "goalCompleted": true,
  "nutritionPreferencesCompleted": true,
  "trainingScheduleCompleted": false,
  "privacyConsentCompleted": true,
  "canGeneratePlan": true,
  "stage1Completed": true,
  "canGenerateFirstPlan": true,
  "missingStage1Fields": [],
  "progressiveProfile": {
    "completedPrompts": ["mealsPerDay"],
    "nextPrompt": {
      "key": "preferredFoods",
      "title": "Foods you enjoy",
      "description": "Add a few foods you like so future plans feel easier to follow.",
      "inputType": "stringList"
    },
    "completionPercent": 9
  }
}
```

For current mobile compatibility, `canGeneratePlan` mirrors `canGenerateFirstPlan`.

## Progressive Prompts

Sprint 5 exposes a lightweight prompt loop after the first plan is available.

Mobile uses `progressiveProfile.nextPrompt` and `GET /v1/progressive-profile/next-prompt` to ask one small follow-up question at a time on Today.

To avoid annoying the user:

- show at most one progressive prompt at a time
- avoid prompting immediately after an error
- prioritize safety prompts before personalization prompts
- ask deeper prompts more often for `PERSONALIZED` and `ADAPTIVE` modes than `BASIC`

## Mobile Stage 1 Flow

Sprint 5 Batch 3 updates the mobile onboarding path to use Stage 1 readiness.

The first-run flow is:

- Profile basics: first name, gender, date of birth, height, weight, activity level, and optional pregnancy/postpartum context only when female is selected
- Goal setup: goal type, plus weight-loss target fields only when the user selects safe weight reduction
- Critical allergy step: enter allergies or choose "No known food allergies"
- Basic training intent: add a schedule item or choose "No training planned yet"
- Today: generate the first plan once `canGenerateFirstPlan=true`

Mobile routing should prefer `canGenerateFirstPlan` when available. If the backend returns `missingStage1Fields`, mobile should route to the most relevant setup step:

- profile fields -> Profile
- goal fields -> Goal
- `allergyInformation` -> Nutrition/allergy step
- `basicTrainingIntent` -> Training schedule

Older onboarding response fields remain available for compatibility.

## Mobile Allergy Confirmation

The mobile nutrition step should make allergy information the only required Stage 1 nutrition answer.

Required copy:

- "Food allergies help us keep your plan safer."
- "No known food allergies"

The user can continue when:

- at least one allergy is entered, or
- `noKnownAllergiesConfirmed=true`

Optional nutrition fields should be visually grouped under "Optional - improve personalization later":

- diet type
- meals per day
- excluded foods
- preferred foods
- notes

## Mobile No-Training Intent

The mobile training step should let the user either add a planned session or choose "No training planned yet".

Required copy:

- "No training planned yet"
- "We'll keep today's training guidance light and safe."

Choosing no training planned calls:

```json
PUT /v1/training-schedule/intent
{
  "noTrainingPlanned": true
}
```

Stage 2 progressive prompts are not part of the Stage 1 gate.

## Batch 4 Progressive Prompt Lifecycle

Sprint 5 Batch 4 adds the first lightweight progressive prompt loop after Today is available.

Backend endpoints:

- `GET /v1/progressive-profile/next-prompt`
- `POST /v1/progressive-profile/prompts/:key/answer`
- `POST /v1/progressive-profile/prompts/:key/skip`

Prompt state is tracked per user in `UserProgressiveProfilePrompt`.

Prompt statuses:

- `PENDING`: the prompt has been shown or selected as the next prompt.
- `ANSWERED`: the user answered it and it should not be shown again.
- `SKIPPED`: the user skipped it and it should not immediately reappear.

Skip behavior:

- `skippedAt` records when the user skipped.
- `skippedUntil` adds a 24-hour cooldown.
- Skipped prompts should not be returned while `skippedUntil` is in the future.

Answer payload:

```json
{
  "value": "string, string[], number, or boolean"
}
```

Prompt answer behavior:

- `PREFERRED_FOODS` merges into preferred foods.
- `EXCLUDED_FOODS` merges into excluded foods.
- `DIET_TYPE` updates nutrition preference diet type.
- `MEALS_PER_DAY` updates nutrition preference meals per day.
- Training and lifestyle prompt answers are stored as prompt answers only for now.

Current prompt priority:

1. `EXCLUDED_FOODS`
2. `PREFERRED_FOODS`
3. `LIMITATIONS_OR_PAIN_AREAS`
4. `EQUIPMENT`
5. `TRAINING_LEVEL`
6. `TARGET_MUSCLE_GROUPS`
7. `COOKING_TIME`
8. `MEAL_PREP`
9. `MEAL_TIMING`
10. `DIET_TYPE`
11. `MEALS_PER_DAY`
12. `TRAINING_OUTCOME`

Mobile behavior:

- Today shows at most one small prompt card.
- The card does not block plan generation.
- The card does not hide the Today plan.
- The user can answer or skip for now.
- After answer or skip, mobile refreshes the next prompt and onboarding status.

Batch 4 does not add check-ins. It should not ask whether the user ate a meal, completed a workout, or how their energy feels. Those belong to Batch 5.

## Safety Notes

Deterministic safety remains the authority for:

- under-18 safe mode
- dangerous weight-loss goals
- allergies and excluded foods
- pregnancy/postpartum-sensitive guidance
- training duration and intensity boundaries
- unsafe pain, illness, dizziness, or exhaustion language

Progressive onboarding must never paywall or defer safety-critical guidance.
