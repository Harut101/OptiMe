# Training Preferences

## Standalone Training ownership

The Training tab owns `TrainingPreference`, target-muscle selection, equipment, experience level, preferred days, limitations, and weekly schedule management. `TrainingSetupForm` is controlled and route-free, and is shared with the optional onboarding step.

The Body Map selects training targets only. Limitations and pain areas remain a separate safety field. Schedule items continue to own workout type, duration, intensity, and description through the existing training-schedule API.

A missing setup does not block planning. The Training tab shows a setup state and safe defaults remain active. Saving preferences affects future plans only and does not regenerate the current plan or modify history.

Training uses the shared draft comparison and unsaved-change guard used by Food, Personal, and Goals. Cancel restores the last persisted preference response, while schedule CRUD remains independently persisted through training-schedule endpoints.

Training preferences are optional profile details used to improve training recommendations. They must not block first plan generation.

Stage 1 onboarding remains safety-first and short. Training preferences belong mostly to Stage 2 progressive profile prompts.

## Fields

### targetMuscleGroups

Body areas or muscle groups the user wants to improve.

Example values:

- `CHEST`
- `TRAPS`
- `LATS`
- `LOWER_BACK`
- `ABS`
- `OBLIQUES`
- `BICEPS`
- `TRICEPS`
- `FOREARMS`
- `QUADRICEPS`
- `HAMSTRINGS`
- `ADDUCTORS`
- `ABDUCTORS`
- `CALVES`
- `GLUTES`
- `SHOULDERS`

Legacy records may still contain `BACK`, `LEGS`, `CORE`, `ARMS`, or `FULL_BODY`. New body-map interactions save only specific muscle groups.

Use:

- Personalize exercise suggestions.
- Shape Plus and Pro training recommendations.
- Keep Free recommendations simple but still useful.

### trainingOutcome

The user's main training direction.

Example values:

- `STRENGTH`
- `MUSCLE_GROWTH`
- `ENDURANCE`
- `MOBILITY`
- `GENERAL_FITNESS`

Use:

- Select training protocol.
- Influence exercise style, sets, reps, duration, and intensity cues.

### equipment

Available training equipment.

Example values:

- `GYM`
- `HOME`
- `DUMBBELLS`
- `BODYWEIGHT`
- `MACHINES`

Use:

- Avoid suggesting unavailable equipment.
- Make Plus and Pro exercise recommendations more practical.

### trainingLevel

Current training experience.

Example values:

- `BEGINNER`
- `INTERMEDIATE`
- `ADVANCED`

Use:

- Keep exercise difficulty level-appropriate.
- Avoid unsafe progression.
- Adjust explanation depth.

### limitationsOrPainAreas

Safety-sensitive limitations, pain areas, or movement concerns.

Examples:

- knee pain
- lower back discomfort
- shoulder limitation
- dizziness during intense workouts

Use:

- Prioritize conservative training guidance.
- Influence recovery protocol.
- Trigger safety checks.

This field is safety-sensitive and should be collected early in progressive prompts. It must not be treated as a diagnosis.

### preferredTrainingDays

Optional preferred training days.

Example values:

- `0` for Sunday
- `1` for Monday
- `6` for Saturday

Use:

- Later schedule refinement.
- Avoid overbuilding in Sprint 6.

## Safety-Sensitive Fields

Safety-sensitive:

- `limitationsOrPainAreas`
- training notes that mention pain, injury, dizziness, illness, exhaustion, or unusual fatigue
- pregnancy, postpartum, or breastfeeding context from profile
- under-18 safe mode

Not safety-sensitive by themselves:

- target muscle groups
- equipment
- training outcome
- training level
- preferred training days

## Progressive Prompt Collection

Recommended prompt order:

1. `limitationsOrPainAreas`
2. `equipment`
3. `trainingLevel`
4. `targetMuscleGroups`
5. `trainingOutcome`
6. `preferredTrainingDays`

Prompt rules:

- Ask one prompt at a time.
- Do not block plan generation.
- Allow skip with cooldown.
- Keep copy supportive and non-medical.
- Use answers immediately in future plan context when available.

## Backend API

Sprint 6 Batch 2 adds protected endpoints:

- `GET /v1/training-preferences`
- `PUT /v1/training-preferences`

`GET` returns the current preference row or safe empty defaults:

```json
{
  "targetMuscleGroups": [],
  "trainingOutcome": null,
  "equipment": [],
  "trainingLevel": null,
  "limitationsOrPainAreas": [],
  "preferredTrainingDays": []
}
```

`PUT` upserts preferences. All fields are optional. Omitted fields stay unchanged; arrays sent as `[]` clear that field.

Example:

```json
{
  "targetMuscleGroups": ["CORE", "LEGS"],
  "trainingOutcome": "STRENGTH",
  "equipment": ["DUMBBELLS", "BODYWEIGHT"],
  "trainingLevel": "BEGINNER",
  "limitationsOrPainAreas": ["knee discomfort"],
  "preferredTrainingDays": [1, 3, 5]
}
```

Validation:

- `targetMuscleGroups`: enum array, max 8.
- `equipment`: enum array, max 5.
- `trainingOutcome`: enum or `null`.
- `trainingLevel`: enum or `null`.
- `limitationsOrPainAreas`: string array, max 20 items, max 120 characters each.
- `preferredTrainingDays`: integer array, values `0-6`, max 7.

## Progressive Prompt Mapping

Existing progressive prompt keys save into `TrainingPreference`:

- `TARGET_MUSCLE_GROUPS` -> `targetMuscleGroups`
- `TRAINING_OUTCOME` -> `trainingOutcome`
- `EQUIPMENT` -> `equipment`
- `TRAINING_LEVEL` -> `trainingLevel`
- `LIMITATIONS_OR_PAIN_AREAS` -> `limitationsOrPainAreas`

Answered training preference prompts should not reappear. Skipped prompts keep the existing cooldown behavior.

## Why Preferences Must Not Block Plan Generation

The user should see value quickly. Missing training preferences should use safe defaults:

- target muscles: `FULL_BODY`
- training outcome: based on goal, or `GENERAL_FITNESS`
- equipment: `BODYWEIGHT`
- training level: `BEGINNER`
- limitations: none reported

Safety-critical signals still override defaults. If a user reports pain, dizziness, illness, exhaustion, or injury, the plan should become more conservative across all tiers.

## Protocol Selection Use

Sprint 6 Batch 3 uses training preferences inside deterministic protocol selection.

Current protocol effects:

- `trainingOutcome=MUSCLE_GROWTH` can select muscle-growth training and muscle-support nutrition.
- `trainingOutcome=STRENGTH` can select strength training.
- `trainingOutcome=ENDURANCE` can select endurance training.
- `trainingOutcome=MOBILITY` can select mobility training.
- `equipment=HOME` or `BODYWEIGHT` can select home workout guidance.
- `trainingLevel=BEGINNER` with gym or machines can select beginner gym guidance.
- `limitationsOrPainAreas` always has safety priority and selects conservative training/recovery.

## Batch Boundary

Sprint 6 Batch 2 stores training preferences and exposes them to planning context.
Sprint 6 Batch 3 uses them for protocol selection.

Still deferred:

- mobile training preference UI
- ExerciseLibrary
- exercise media

Implemented after Batch 3:

- optional text-based `training.exercises`
- exercise safety checks
- Plan Details exercise rendering when exercises are present
