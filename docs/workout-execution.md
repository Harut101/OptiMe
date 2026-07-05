# Workout Execution MVP

Workout Execution lets a user start and complete a workout from the exercises already stored in a Daily Plan. It is plan-linked execution tracking, not a standalone workout builder.

## Scope

- Start a workout from Plan Details Training tab.
- Run an optional pre-workout check before starting a new workout session.
- Detect pain/limitation conflicts against the planned exercises before the session starts.
- Adjust today's workout only when the user explicitly chooses that action.
- Resume an in-progress workout for the same Daily Plan.
- Track completed sets for set-based exercises.
- Track exercise-level completion for duration/no-set exercises.
- Finish a workout with confirmation when only partially completed.
- Offer an optional post-workout check-in after completion.
- Preserve old Daily Plans and free-text exercises.

Out of scope: timers, automatic exercise replacement without confirmation, exercise-library editing, media upload, analytics, medical diagnosis, and OpenAI calls from workout execution.

## Data Model

`WorkoutSession` is unique per `userId + dailyPlanId`. Starting the same plan twice returns the existing session. This keeps resume behavior simple and prevents duplicate execution rows if the user double taps Start.

The optional pre-workout check is stored on `WorkoutSession`, not on `DailyPlan`:

- `GOOD`
- `TIRED`
- `SORE`
- `PAIN_OR_LIMITATION`
- `SKIPPED`

`painAreas` and `note` are scoped to the current session. They are not global Training Settings and do not mutate the saved DailyPlan JSON.

When pain or limitation is selected, the backend maps the selected body areas to `TargetMuscleGroup` values and compares them with planned exercise snapshots. If an overlap exists, the session cannot start silently. The user must choose one of the safe actions:

- Adjust today's workout.
- Rest today.
- Continue with caution.

Continue with caution requires explicit acknowledgement and stores conflict metadata on the `WorkoutSession`.

Post-workout feedback is stored on the completed `WorkoutSession` only:

- `GOOD`
- `TOO_EASY`
- `TOO_HARD`
- `PAIN_DURING_WORKOUT`
- `SKIPPED`

It can include optional pain areas and a short note. It does not mutate the completed workout or DailyPlan.

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
5. If pain/limitation is selected, the backend runs a preflight conflict check before creating a session.
6. If no conflict exists, the backend snapshots `plan.training.exercises` and stores the current-session pre-workout check.
7. If a conflict exists, mobile shows Adjust today, Rest today, and Continue with caution.
8. User toggles sets or duration exercise completion.
9. User taps Finish workout.
10. If partial, mobile asks for confirmation before completing.
11. Mobile offers an optional post-workout check-in.
12. Completed sessions become read-only.

REST plans and plans without exercises cannot start a workout session.

## Completed Summary And History

Completed sessions expose a server-owned `WorkoutSessionSummary`. The summary includes local date, start/completion times, completed/planned counts, partial state, focus labels, environment, and duration when available.

Workout history lists completed sessions only, newest first. Completed sessions remain read-only when opened from history.

## API

All endpoints require JWT auth and only return sessions owned by the current user.

```txt
POST /v1/workout-sessions
POST /v1/workout-sessions/preflight-check
GET /v1/workout-sessions/by-plan/:dailyPlanId
GET /v1/workout-sessions/:sessionId
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId/sets
PATCH /v1/workout-sessions/:sessionId/exercises/:progressId
POST /v1/workout-sessions/:sessionId/complete
PATCH /v1/workout-sessions/:sessionId/post-workout-check-in
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
    "note": null,
    "acknowledgedPainConflict": false
  }
}
```

The `preWorkoutCheck` field is optional for backward compatibility.

`POST /v1/workout-sessions/preflight-check` checks ownership and detects whether selected pain areas overlap planned exercise target muscles. It does not create a session and does not mutate the DailyPlan.

`POST /v1/daily-plans/:dailyPlanId/training/adjust-for-pre-workout` updates only today's DailyPlan training section when the user explicitly chooses Adjust today. It preserves nutrition, the local date, and Weekly Routine.

`PATCH /v1/workout-sessions/:sessionId/post-workout-check-in` is allowed only after the session is completed.

## Safety And Privacy

The workout route shows a supportive safety reminder: stop if pain, dizziness, or unusual discomfort appears. Safety is not tier-gated.

If the pre-workout check includes pain or limitation, the app checks for overlap with the planned workout before the session starts. Conflict copy must stay supportive and should recommend adjusting or resting before continuing with caution. The app does not diagnose, treat, or encourage training through pain.

Server logs include only safe metadata such as session IDs, plan IDs, progress IDs, counts, and status. They must not include raw profile data, private health notes, AI prompts, access tokens, or API keys.

## Mobile Behavior

Today remains unchanged. Workout execution is only available from Plan Details Training tab.

Plan Details shows:

- Start workout when no session exists.
- Continue workout when a session is in progress.
- View workout when completed.
- A small progress summary when a session exists.
- A pre-workout check only after the user taps Start workout.

The workout screen renders exercise names, optional thumbnails, planned prescription, set controls, completion controls, safety notes, and Exercise Details links for library-backed exercises.

After Finish workout, the workout screen can show an optional post-workout check-in. Completed workout details show saved feedback when available. The Training tab and Plan Details should not show an always-visible generic "Training check-in" block.

If the saved Daily Plan includes `trainingLoadAgentSnapshot`, the workout screen shows a concise session-level guidance note. This note is read-only and cannot replace exercises, change sets/reps, or mutate the workout session.

## Legacy Support

Older Daily Plans without exercises do not show workout controls. Free-text exercises without library IDs can still be tracked, but they do not open Exercise Details.

## Verification

Run:

```powershell
$env:TEST_DATABASE_URL='postgresql://optime:optime@localhost:5432/optime_test?schema=public'
& "$env:APPDATA\npm\pnpm.cmd" --filter @optime/api test:e2e -- workout-sessions.e2e-spec.ts
```
