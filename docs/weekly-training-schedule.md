# Weekly Training Schedule

The weekly training schedule is the foundation for day-specific training context. It lets a user keep training optional while still giving OptiMe enough structure to make future daily plans more useful when training is enabled.

## Scope

- A schedule contains seven days, Monday through Sunday.
- Each day can be a training day or a rest day.
- Training days can inherit global training preferences or customize target muscles, location, available equipment, duration, and protocol preference.
- Rest days are treated as recovery context and should not generate a normal strength workout.
- Disabling training through app mode does not delete saved training preferences or weekly schedule settings.

## Location vs Equipment

Location and equipment are intentionally separate.

- Location is context: `HOME`, `GYM`, or `OUTDOOR`.
- Equipment is a hard filter for exercise selection.
- `HOME + BARBELL` is valid when the user explicitly has a barbell at home.
- `GYM` does not automatically add `BARBELL`; the user must select it.
- `BARBELL` remains available in the day-specific equipment selector because it exists in the shared `ExerciseEquipment` enum.

## Daily Plan Integration

Daily plan generation resolves the active day before selecting exercises.

- `NUTRITION_ONLY` skips exercise selection and returns a safe rest-style training block.
- `NUTRITION_AND_TRAINING` can use the resolved day to filter exercises by target muscles, equipment, duration, and rest-day status.
- Existing daily plans are not mutated when app mode or weekly schedule changes.
- Future daily plans receive the updated context.

## Safety

Safety is not paywalled and is not bypassed by schedule settings.

- Pain, limitations, pregnancy/postpartum context, safe mode, and minor-user rules still apply.
- Rest days do not generate normal strength workouts.
- Equipment filtering is deterministic before AI wording is considered.

## Deferred

- Workout execution sessions.
- Workout history.
- Rest timers.
- AI-generated weekly schedules.
- Exercise media expansion beyond the current library-backed plan details flow.
