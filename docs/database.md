# Database Notes

## Workout Execution

Workout execution adds two plan-linked tables:

- `WorkoutSession`
- `WorkoutExerciseProgress`

`WorkoutSession` has a unique key on `userId + dailyPlanId` so each user can have only one execution session per Daily Plan.

`WorkoutExerciseProgress` has a unique key on `workoutSessionId + planExerciseKey` so each planned exercise snapshot is tracked once per session.

The workout rows cascade when the owning user or Daily Plan is deleted. E2E cleanup deletes workout progress and sessions before Daily Plans for clarity.
