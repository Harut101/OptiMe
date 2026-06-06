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

## Future Progressive Prompts

Sprint 5 Batch 2 only exposes `nextPrompt`; it does not add prompt answer or skip endpoints.

Future mobile batches can use `progressiveProfile.nextPrompt` to ask one small follow-up question at a time, preferably after the user has viewed or refreshed a plan.

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

Optional nutrition fields should be visually grouped under "Optional — improve personalization later":

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

Batch 4 should add progressive prompt UI for Stage 2 personalization. It should not be part of the Stage 1 gate.

## Safety Notes

Deterministic safety remains the authority for:

- under-18 safe mode
- dangerous weight-loss goals
- allergies and excluded foods
- pregnancy/postpartum-sensitive guidance
- training duration and intensity boundaries
- unsafe pain, illness, dizziness, or exhaustion language

Progressive onboarding must never paywall or defer safety-critical guidance.
