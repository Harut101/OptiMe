# Sprint 6 Summary

Sprint 6 improved core plan quality before adding more monetization or external integrations.

The main product principle was:

AI should customize deterministic protocols and templates instead of inventing the full plan from scratch.

## What Sprint 6 Added

### TrainingPreference Backend/API

Sprint 6 added optional training preferences:

- target muscle groups
- training outcome
- available equipment
- training level
- limitations or pain areas
- preferred training days

Backend endpoints:

- `GET /v1/training-preferences`
- `PUT /v1/training-preferences`

Training preferences do not block first plan generation. Missing values use safe defaults.

### Progressive Prompt Integration

Stage 2 progressive prompts can save training preference answers:

- `TARGET_MUSCLE_GROUPS`
- `TRAINING_OUTCOME`
- `EQUIPMENT`
- `TRAINING_LEVEL`
- `LIMITATIONS_OR_PAIN_AREAS`

Answered prompts do not reappear. Skipped prompts keep the existing cooldown behavior.

### ProtocolSelectorService

Sprint 6 added deterministic nutrition, training, and recovery protocol selection.

Selection uses:

- profile safety state
- pregnancy, postpartum, or breastfeeding context
- goal
- training schedule
- no-training-planned intent
- training preferences
- recent check-in summary
- `PlanQualityMode`

Safety-sensitive context has priority over personalization.

### Nutrition/Training/Recovery Protocols

Implemented protocol catalogs include:

- nutrition protocols such as `SAFE_WEIGHT_LOSS`, `MUSCLE_GAIN`, `UNDER_18_SAFE`, and `PREGNANCY_POSTPARTUM_SAFE`
- training protocols such as `STRENGTH`, `MUSCLE_GROWTH`, `HOME_WORKOUT`, `NO_TRAINING_PLANNED`, and `CONSERVATIVE_PAIN_LIMITATION`
- recovery protocols such as `NORMAL_RECOVERY`, `HIGH_TIREDNESS`, `PAIN_OR_DISCOMFORT`, and `REST_DAY`

Protocols guide AI generation. They do not replace `SafetyService` or the Safety Agent.

### selectedProtocols In AiProvider Context

`DailyPlansService` passes selected protocols into `AiProvider` personalization context.

Persisted debug metadata stores protocol IDs only:

```json
{
  "debug": {
    "protocols": {
      "nutritionProtocolId": "MUSCLE_GAIN",
      "trainingProtocolId": "MUSCLE_GROWTH",
      "recoveryProtocolId": "NORMAL_RECOVERY"
    }
  }
}
```

Mobile must not render debug metadata.

### Optional training.exercises

`DailyPlanJson.training.exercises` is now optional and text-only.

Each exercise can include:

- name
- target muscles
- equipment
- sets, reps, rest, or duration
- intensity cue
- safety notes

Existing plans without exercises remain valid.

### Exercise Safety Checks

`SafetyService` validates exercise guidance after provider generation.

It rejects:

- training through pain, dizziness, illness, injury, exhaustion, fatigue, or discomfort
- max-effort or to-failure language in sensitive contexts
- unsafe beginner progression
- unsafe pregnancy, postpartum, or breastfeeding exercise guidance
- under-18 or safeMode unsafe intensity
- obvious conflicts with limitations, such as telling the user to ignore knee pain

The OpenAI Safety Agent also reviews exercise recommendations semantically.

### Plan Details Exercise Rendering

Mobile Plan Details renders a `Suggested exercises` section when `training.exercises` exists.

Today remains unchanged and does not render exercises.

The rendering is text-only:

- no images
- no videos
- no animations
- no ExerciseLibrary references

## Remaining Limitations

- No ExerciseLibrary.
- No exercise images or videos.
- No advanced progression engine.
- No mobile UI for editing training preferences directly.
- No Apple Health, Health Connect, or WHOOP integration yet.
- No real payment or purchase flow.
- Exercise recommendations are text-based and rely on provider output plus safety checks.

## Out Of Scope For Sprint 6

- Real payments.
- App Store / Google Play purchase flow.
- Receipt validation.
- WHOOP integration.
- AI Coach chat.
- Embeddings.
- Admin or web.
- ExerciseLibrary.
- Exercise media.

## Verification

Sprint 6 closure verification:

- API build passing.
- E2E passing.
- Mobile typecheck passing.

Use the exact command outputs from the closing batch as the source of truth.

## Recommended Sprint 7 Direction

Sprint 7 should focus on Apple Health / Health Connect foundation before WHOOP and real payments.

Why:

- Apple Health and Health Connect cover broader health/wearable data than WHOOP alone.
- They can improve `ADAPTIVE` planning with steps, sleep, workouts, active energy, and weight when available.
- They strengthen product value before asking users to pay.
- They create a privacy and permissions foundation that can later support WHOOP and Pro features.

Sprint 7 should stay foundation-focused:

- optional user consent
- iOS HealthKit
- Android Health Connect
- safe backend sync model
- normalized health signals
- protocol influence from health data
- no medical diagnosis
- plan generation must still work without health data
