# Workout History MVP

Workout History gives users a neutral record of completed Workout Sessions. It uses the existing plan-linked `WorkoutSession` and `WorkoutExerciseProgress` data and does not create separate analytics or performance models.

## Scope

- Completed workout summaries.
- Completed workout history list.
- Opening a completed workout in read-only mode.
- Partial completion labels.
- Legacy free-text exercise support.

Out of scope: streaks, achievements, charts, load tracking, rest timers, RPE, workout notes, personal records, exercise replacement, and wearable sync.

## Summary DTO

The backend owns summary counts and returns a mobile-friendly shape:

```ts
type WorkoutSessionSummary = {
  id: string;
  dailyPlanId: string;
  status: "IN_PROGRESS" | "COMPLETED";
  localDate: string;
  startedAt: string;
  completedAt: string | null;
  plannedExerciseCount: number;
  completedExerciseCount: number;
  plannedSetCount: number;
  completedSetCount: number;
  isPartial: boolean;
  title: string;
  subtitle: string | null;
  primaryMuscleGroups: string[];
  environment: string | null;
  durationMinutes: number | null;
};
```

The summary does not include raw user IDs, raw `DailyPlan.planJson`, private notes, or health-sensitive data.

## API

```txt
GET /v1/workout-sessions/history
GET /v1/workout-sessions/history?limit=20&cursor=...
GET /v1/workout-sessions/:sessionId/summary
```

History is authenticated, user-scoped, completed-only, newest first, and capped to a safe limit. `nextCursor` is returned when another page is available.

## Mobile

Entry points:

- Training tab: Workout history.
- Profile Personal section: Completed workouts.
- Today: compact completed summary only when today's current plan has a completed session.

Completed details reuse the `workout-session` route. Completed sessions are read-only: no set toggles, no exercise completion changes, and no finish button.

## Partial Completion

Partial completion is valid and neutral. Use:

- `Partial workout saved`
- `You completed part of this workout.`

Avoid failure or shame wording.

## Legacy Compatibility

Free-text exercises without `exerciseId` still render in history and read-only details. They do not open Exercise Details.
