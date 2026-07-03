# Workout Execution MVP

Workout Execution lets a user start and complete a workout from the exercises already stored in a Daily Plan. It is plan-linked execution tracking, not a standalone workout builder.

## Scope

- Start a workout from Plan Details Training tab.
- Run an optional pre-workout check before starting a new workout session.
- Resume an in-progress workout for the same Daily Plan.
- Track completed sets for set-based exercises.
- Track exercise-level completion for duration/no-set exercises.
- Finish a workout with confirmation when only partially completed.
- Preserve old Daily Plans and free-text exercises.

Out of scope: timers, replacing planned exercises, exercise-library editing, media upload, analytics, AI workout mutation from the pre-workout check, and OpenAI calls from workout execution.

## Data Model

`WorkoutSession` is unique per `userId + dailyPlanId`. Starting the same plan twice returns the existing session. This keeps resume behavior simple and prevents duplicate execution rows if the user double taps Start.

The optional pre-workout check is stored on `WorkoutSession`, not on `DailyPlan`:

- `GOOD`
- `TIRED`
- `SORE`
- `PAIN_OR_LIMITATION`
- `SKIPPED`

`painAreas` and `note` are scoped to the current session. They are not global Training Settings and do not mutate the saved DailyPlan JSON.

`WorkoutExerciseProgress` snapshots the planned exercises at session start:

- `planExerciseKey`
- `planExerciseOrder`
- `exerciseId`
- `exerciseSlug`
- `exerciseNameSnapshot`
- `plannedSets`
- `plannedReps`
- `plannedDurationSeconds`
- `plannedRestSeconds`
- `completedSetIndexes`
- `isExerciseCompleted`

Snapshots are intentionally immutable. Later edits to DailyPlan JSON or ExerciseLibrary content do not rewrite an in-progress or completed workout session.

## Lifecycle

1. User opens Plan Details.
2. Training tab checks whether a workout session exists for the current Daily Plan.
3. User taps Start workout.
4. Mobile shows a skippable pre-workout check.
5. Backend snapshots `plan.training.exercises` and stores the current-session pre-workout check if provided.
6. User toggles sets or duration exercise completion.
7. User taps Finish workout.
8. If partial, mobile asks for confirmation before completing.
9. Completed sessions become read-only.

REST plans and plans without exercises cannot start a workout session.

## Completed Summary And History

Completed sessions expose a server-owned `WorkoutSessionSummary`. The summary includes local date, start/completion times, completed/planned counts, partial state, focus labels, environment, and duration when available.

Workout history lists completed sessions only, newest first. Completed sessions remain read-only when opened from history.

## API

All endpoints require JWT auth and only return sessions owned by the current user.

```txt
POST /v1/workout-sessions
GET /v1/workout-sessions/by-plan/:dailyPlanId
GET /v1/workout-sessions/:sessionId
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId/sets
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId
POST /v1/workout-sessions/:sessionId/complete
GET /v1/workout-sessions/history
GET /v1/workout-sessions/:sessionId/summary
```

Set progress uses zero-based `setIndex`. Duration/no-set exercises use exercise-level completion and reject set toggles.

`POST /v1/workout-sessions` accepts:

```json
{
  "dailyPlanId": "plan_id",
  "preWorkoutCheck": {
    "readinessStatus": "GOOD",
    "painAreas": [],
    "note": null
  }
}
```

The `preWorkoutCheck` field is optional for backward compatibility.

## Safety And Privacy

The workout route shows a supportive safety reminder: stop if pain, dizziness, or unusual discomfort appears. Safety is not tier-gated.

If the pre-workout check includes pain or limitation, the workout screen shows a supportive controlled-intensity reminder. The app does not diagnose, treat, or encourage training through pain.

Server logs include only safe metadata such as session IDs, plan IDs, progress IDs, counts, and status. They must not include raw profile data, private health notes, AI prompts, access tokens, or API keys.

## Mobile Behavior

Today remains unchanged. Workout execution is only available from Plan Details Training tab.

Plan Details shows:

- Start workout when no session exists.
- Continue workout when a session is in progress.
- View workout when completed.
- A small progress summary when a session exists.

The workout screen renders exercise names, optional thumbnails, planned prescription, set controls, completion controls, safety notes, and Exercise Details links for library-backed exercises.

## Legacy Support

Older Daily Plans without exercises do not show workout controls. Free-text exercises without library IDs can still be tracked, but they do not open Exercise Details.

## Verification

Run:

```powershell
$env:TEST_DATABASE_URL='postgresql://optime:optime@localhost:5432/optime_test?schema=public'
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api test:e2e -- workout-sessions.e2e-spec.ts
```
