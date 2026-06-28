# Workout Execution MVP

Workout Execution lets a user start and complete a workout from the exercises already stored in a Daily Plan. It is plan-linked execution tracking, not a standalone workout builder.

## Scope

- Start a workout from Plan Details Training tab.
- Resume an in-progress workout for the same Daily Plan.
- Track completed sets for set-based exercises.
- Track exercise-level completion for duration/no-set exercises.
- Finish a workout with confirmation when only partially completed.
- Preserve old Daily Plans and free-text exercises.

Out of scope: workout history screens, timers, notes, perceived exertion, replacing planned exercises, exercise-library editing, media upload, and analytics.

## Data Model

`WorkoutSession` is unique per `userId + dailyPlanId`. Starting the same plan twice returns the existing session. This keeps resume behavior simple and prevents duplicate execution rows if the user double taps Start.

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
4. Backend snapshots `plan.training.exercises`.
5. User toggles sets or duration exercise completion.
6. User taps Finish workout.
7. If partial, mobile asks for confirmation before completing.
8. Completed sessions become read-only.

REST plans and plans without exercises cannot start a workout session.

## API

All endpoints require JWT auth and only return sessions owned by the current user.

```txt
POST /v1/workout-sessions
GET /v1/workout-sessions/by-plan/:dailyPlanId
GET /v1/workout-sessions/:sessionId
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId/sets
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId
POST /v1/workout-sessions/:sessionId/complete
```

Set progress uses zero-based `setIndex`. Duration/no-set exercises use exercise-level completion and reject set toggles.

## Safety And Privacy

The workout route shows a supportive safety reminder: stop if pain, dizziness, or unusual discomfort appears. Safety is not tier-gated.

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
