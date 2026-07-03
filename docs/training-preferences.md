# Training Preferences

## Standalone Training ownership

The Training tab owns general `TrainingPreference` defaults and Weekly Routine management. `TrainingSetupForm` is controlled and route-free, and is shared with the optional onboarding step where needed.

The Body Map is used for day-specific muscle focus in Weekly Routine and progressive prompts. Limitations and pain areas are no longer a visible global Training Setup field; current pain or limitations are collected through the pre-workout check before starting a workout session. Legacy `limitationsOrPainAreas` can remain for compatibility and progressive profile data, but it should not be the primary mobile setup UX.

Weekly Routine owns training days, target muscles, environment, concrete equipment, duration, and protocol preference. The backend may keep existing schedule API names for compatibility.

A missing setup does not block planning. The Training tab shows a setup state and safe defaults remain active. Saving preferences affects future plans only and does not regenerate the current plan or modify history.

Training uses the shared draft comparison and unsaved-change guard used by Food, Personal, and Goals. Cancel restores the last persisted preference response, while schedule CRUD remains independently persisted through training-schedule endpoints.

Training preferences are optional profile details used to improve training recommendations. They must not block first plan generation.

ExerciseLibrary reuses the existing `TrainingLevel` and canonical `TargetMuscleGroup` values. Weekly Routine keeps environment (`HOME`, `GYM`, `OUTDOOR`) separate from concrete equipment (`BARBELL`, `DUMBBELLS`, `BODYWEIGHT`, etc.). Gym does not imply access to every equipment type.

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

Legacy/default training equipment.

Example values:

- `DUMBBELLS`
- `BODYWEIGHT`
- `MACHINES`

Use:

- Provide general defaults when no day-specific routine equipment is set.
- Keep simple setup fast.

Day-specific equipment lives in Weekly Routine and uses the richer `ExerciseEquipment` enum. `HOME + BARBELL` is valid when explicitly selected on a routine day.

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

Legacy safety-sensitive limitations, pain areas, or movement concerns.

Examples:

- knee pain
- lower back discomfort
- shoulder limitation
- dizziness during intense workouts

Use:

- Preserve older/progressive-profile context.
- Avoid treating this as the primary current-session safety signal.

Current pain, soreness, tiredness, or limitation should be collected in the pre-workout check and stored on `WorkoutSession`.

### preferredTrainingDays

Legacy optional preferred training days.

Example values:

- `0` for Sunday
- `1` for Monday
- `6` for Saturday

Use:

- Compatibility only.
- Do not show as a primary mobile setup field; Weekly Routine owns days.

## Safety-Sensitive Fields

Safety-sensitive:

- current-session pre-workout check pain/limitation status
- legacy `limitationsOrPainAreas` when present
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

1. `equipment`
2. `trainingLevel`
3. `targetMuscleGroups`
4. `trainingOutcome`
5. `limitationsOrPainAreas` only as progressive/history context, not current-session state

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
  "limitationsOrPainAreas": [],
  "preferredTrainingDays": []
}
```

Validation:

- `targetMuscleGroups`: enum array, max 8.
- `equipment`: enum array, max 5.
- `trainingOutcome`: enum or `null`.
- `trainingLevel`: enum or `null`.
- `limitationsOrPainAreas`: string array, max 20 items, max 120 characters each. Compatibility/progressive context only.
- `preferredTrainingDays`: integer array, values `0-6`, max 7. Compatibility only; Weekly Routine owns visible days.

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

Safety-critical signals still override defaults. If a user reports pain, dizziness, illness, exhaustion, or injury in any current-session flow, guidance should become more conservative across all tiers.

## Protocol Selection Use

Sprint 6 Batch 3 uses training preferences inside deterministic protocol selection.

Current protocol effects:

- `trainingOutcome=MUSCLE_GROWTH` can select muscle-growth training and muscle-support nutrition.
- `trainingOutcome=STRENGTH` can select strength training.
- `trainingOutcome=ENDURANCE` can select endurance training.
- `trainingOutcome=MOBILITY` can select mobility training.
- day-specific environment `HOME` or equipment `BODYWEIGHT` can select home/bodyweight workout guidance.
- `trainingLevel=BEGINNER` with gym or machines can select beginner gym guidance.
- legacy `limitationsOrPainAreas` remains safety-sensitive when present.
- pre-workout `PAIN_OR_LIMITATION` applies only to the current workout session.

## Batch Boundary

Sprint 6 Batch 2 stores training preferences and exposes them to planning context.
Sprint 6 Batch 3 uses them for protocol selection.

Still deferred:

- mobile training preference UI
- exercise media

## Exercise selection integration

Saved target muscles, concrete equipment, level, limitations presence, and schedule duration now feed deterministic ExerciseLibrary selection. Missing equipment uses bodyweight/NONE candidates. Legacy broad muscle groups normalize at the read boundary and are not saved back. Preferences affect future generation only.

Implemented after Batch 3:

- optional text-based `training.exercises`
- exercise safety checks
- Plan Details exercise rendering when exercises are present
## Localization

Training environment, outcome, level, equipment, Weekly Routine, pre-workout check, muscle labels, and editor states use centralized translations. API payloads continue to contain exact enum values, never translated labels or Body Map path IDs.
