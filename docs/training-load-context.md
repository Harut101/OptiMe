# Training Load Context

`TrainingLoadContext` is a deterministic planning summary derived from `WearablePlanningContext`.

## Shape

- `hasTrainingLoadContext`
- `readinessHint`: `NORMAL`, `CONTROLLED`, `LIGHT`, `RECOVERY_FOCUSED`, or `UNKNOWN`
- `reasons`: `LOW_SLEEP`, `HIGH_ACTIVITY`, `RECENT_WORKOUT_LOAD`, `PARTIAL_WEARABLE_DATA`, `STALE_WEARABLE_DATA`, `NO_WEARABLE_DATA`
- `suggestedAdjustment`: conservative intensity, volume, and rest-time hints
- `userFacingHint`: a short safe note or `null`

## Conservative Thresholds

- Low sleep: under 360 minutes.
- High activity: at least 12,000 steps, 900 active kcal, 60 workout minutes, or strain score at least 15 when available.
- Recent workout load: any workout minutes in the wearable snapshot.

## Product Boundary

This is not a Training Load Agent. It does not diagnose recovery, calculate readiness scores, or replace exercise selection. Future agents may use this context, but deterministic safety remains the authority.
