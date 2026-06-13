# Protocol / Template Layer

The protocol layer gives the backend deterministic planning structure before AI generation.

AI should customize and explain selected protocols. AI should not invent the entire plan from scratch, and it must not override protocol safety rules.

## Why Protocols Exist

Protocols help OptiMe:

- Reduce hallucinations.
- Improve plan consistency.
- Make safety rules explicit.
- Improve testing.
- Reduce prompt ambiguity.
- Make Plus and Pro personalization more valuable.

Sprint 6 should keep this layer simple. Do not build a complex rules engine yet.

## Sprint 6 Batch 3 Status

Implemented:

- `ProtocolModule`
- `ProtocolSelectorService`
- deterministic nutrition, training, and recovery protocol catalogs
- selected protocol context passed to `AiProvider`
- safe debug metadata with protocol IDs only

Deferred:

- mobile exercise rendering
- `ExerciseLibrary`
- exercise images or videos
- deep OpenAI prompt orchestration

## Protocol Output Shape

```ts
{
  nutritionProtocol: {
    id: string;
    title: string;
    rules: string[];
    safetyRules: string[];
  };
  trainingProtocol: {
    id: string;
    title: string;
    recommendedIntensity: string;
    exerciseGuidance: string[];
    safetyRules: string[];
  };
  recoveryProtocol: {
    id: string;
    title: string;
    rules: string[];
    safetyRules: string[];
  };
  selectionReasons: string[];
}
```

## NutritionProtocol Design

Nutrition protocols should describe the day-level nutrition strategy without exact aggressive calorie targets.

Examples:

- `SAFE_WEIGHT_LOSS`
- `MUSCLE_GAIN`
- `MAINTENANCE`
- `PREGNANCY_POSTPARTUM_SAFE`
- `UNDER_18_SAFE`
- `RECOVERY_DAY`

Example:

```ts
{
  id: 'SAFE_WEIGHT_LOSS',
  title: 'Safe weight-loss nutrition',
  rules: [
    'Use balanced meals with protein, fiber, steady-energy carbohydrates, and satisfying fats.',
    'Prefer practical portions and consistency over strict restriction.'
  ],
  safetyRules: [
    'Do not recommend starvation, skipped meals, detoxes, cleanses, or extreme calorie restriction.',
    'Do not use shame-based or body-pressure language.'
  ]
}
```

## TrainingProtocol Design

Training protocols should guide intensity, exercise style, and safety boundaries.

Examples:

- `STRENGTH`
- `ENDURANCE`
- `MOBILITY`
- `RECOVERY`
- `BEGINNER_GYM`
- `HOME_WORKOUT`
- `NO_TRAINING_PLANNED`

Example:

```ts
{
  id: 'HOME_WORKOUT',
  title: 'Home workout',
  recommendedIntensity: 'MODERATE',
  exerciseGuidance: [
    'Prefer bodyweight or available simple equipment.',
    'Use clear beginner-friendly movement options when training level is missing.'
  ],
  safetyRules: [
    'Do not recommend training through pain, dizziness, illness, injury, or exhaustion.',
    'Reduce intensity when recent check-ins report pain or high tiredness.'
  ]
}
```

## RecoveryProtocol Design

Recovery protocols should influence push, maintain, or recover decisions.

Examples:

- `HIGH_TIREDNESS`
- `PAIN_DISCOMFORT`
- `POOR_SLEEP_PLACEHOLDER`
- `HIGH_SORENESS`
- `PREGNANCY_POSTPARTUM_CONSERVATIVE`
- `STANDARD_RECOVERY`

Example:

```ts
{
  id: 'PAIN_DISCOMFORT',
  title: 'Pain/discomfort conservative recovery',
  rules: [
    'Prefer rest, mobility, or light movement.',
    'Keep training guidance conservative and practical.'
  ],
  safetyRules: [
    'Do not diagnose pain or injury.',
    'Do not tell the user to push through pain.'
  ]
}
```

## Protocol Selection Inputs

Use:

- profile safe mode and age context
- pregnancy/postpartum/breastfeeding context
- goal
- training schedule
- no-training-planned intent
- training preferences when available
- recent check-ins
- PlanQualityMode

## Current Deterministic Selection Rules

Safety-sensitive context has priority over personalization:

- Pregnancy, postpartum, or breastfeeding context selects `PREGNANCY_POSTPARTUM_SAFE` nutrition and `PREGNANCY_POSTPARTUM_CONSERVATIVE` recovery.
- Under-18 or `safeMode` selects `UNDER_18_SAFE` nutrition and light movement-oriented training.
- Pain, discomfort, or saved limitations select `CONSERVATIVE_PAIN_LIMITATION` training and `PAIN_OR_DISCOMFORT` recovery.
- No training planned, or no saved schedule rows, selects `NO_TRAINING_PLANNED` training and `REST_DAY` recovery.
- High tiredness check-ins select recovery-oriented nutrition, training, and recovery protocols.
- Muscle-gain goals or `trainingOutcome=MUSCLE_GROWTH` select `MUSCLE_GAIN` nutrition and muscle-growth training.
- Weight-reduction goals select `SAFE_WEIGHT_LOSS` unless pregnancy or under-18 rules override them.
- Beginner gym context selects `BEGINNER_GYM`.
- Home or bodyweight equipment selects `HOME_WORKOUT`.

`PlanQualityMode` changes explanation depth and how much context AI should use. It must not weaken safety or change hard safety rules.

## Daily Plan Debug Metadata

When a daily plan is generated, the backend may persist safe debug protocol IDs:

```json
{
  "debug": {
    "protocols": {
      "nutritionProtocolId": "SAFE_WEIGHT_LOSS",
      "trainingProtocolId": "HOME_WORKOUT",
      "recoveryProtocolId": "NORMAL_RECOVERY"
    }
  }
}
```

Only IDs are stored in debug metadata. Full profile data, prompts, and full protocol text are not stored there.

## OpenAI Customization Rules

OpenAI should receive:

- selected protocol IDs
- protocol rules
- protocol safetyRules
- user context needed for personalization
- PlanQualityMode

OpenAI should:

- customize meals, training copy, exercise suggestions, and recovery guidance
- use selected training protocols to shape optional `training.exercises`
- keep copy supportive and practical
- follow protocol safetyRules exactly
- avoid inventing unavailable data

OpenAI must not:

- override safetyRules
- recommend restricted foods
- recommend training through symptoms
- invent WHOOP data
- turn protocols into rigid medical advice

Deterministic `SafetyService` and the optional Safety Agent still run after provider generation. Protocols guide generation; they do not replace safety validation.

Sprint 6 Batch 4 adds optional text-based `training.exercises`. Protocols can guide the exercise list, but providers must not include ExerciseLibrary IDs, images, videos, or media references.

## Future Extensions

Possible future additions:

- protocol versioning
- protocol experiments
- locale-specific protocol variations
- ExerciseLibrary-backed exercise IDs

These are deferred until the simple protocol layer proves useful.
