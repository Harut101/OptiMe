# AI Training Load Agent MVP

The AI Training Load Agent adds a semantic training-load explanation layer after deterministic planning has already selected the workout structure.

It does not replace deterministic safety, exercise selection, wearable planning, or workout volume rules.

## Inputs

The agent receives bounded planning context only:

- resolved Weekly Routine or one-off Daily Training Override context
- `WorkoutVolumePlanner` output
- selected exercise candidates and final planned exercises
- `WearablePlanningContext` and `TrainingLoadContext`
- pre-workout/check-in summary when available
- training level, safe mode, pregnancy/postpartum context, and PlanQualityMode

It must not receive passwords, access tokens, raw prompts, API keys, or unnecessary private data.

## Output

The agent writes optional `DailyPlanJson.trainingLoadAgentSnapshot`:

- `source`: `AI_TRAINING_LOAD_AGENT` or `DETERMINISTIC_FALLBACK`
- `readiness`: `NORMAL`, `CONTROLLED`, `LIGHT`, `RECOVERY_FOCUSED`, or `UNKNOWN`
- `adjustments`: intensity, volume, and rest-time guidance
- `reasonCodes`: safe machine-readable reasons
- `userFacingSummary`: one supportive sentence
- `trainingGuidanceBullets`: short practical training guidance
- `exerciseCautions`: optional cautions tied only to planned exercises
- `validation`: `VALID`, `FALLBACK`, or `INVALID` with safe reasons

Older Daily Plans without this snapshot remain valid.

## Boundaries

The agent may:

- explain why the workout should be normal, controlled, lighter, or recovery-focused
- suggest longer rests, controlled pacing, and stopping if pain increases
- attach caution text to already planned exercises

The agent must not:

- invent, replace, swap, or cancel exercises
- override ExerciseSelectionService or equipment filters
- replace WorkoutVolumePlanner numeric limits
- change calorie or macro targets
- diagnose medical conditions
- tell the user to push through pain, dizziness, illness, injury, exhaustion, or unusual discomfort

## Retry And Fallback

OpenAI output is structured JSON and validated locally. Invalid output retries once with machine-readable validation feedback.

If retry fails, the backend stores a deterministic fallback snapshot. Daily Plan generation can still finish as `READY` when the main plan passes schema, deterministic safety, and Safety Agent review.

## Mobile

- Today shows only a compact training-load note.
- Plan Details Training tab shows detailed guidance and exercise cautions.
- Workout Session shows session-level guidance.

Mobile never renders debug metadata and never calls OpenAI.
