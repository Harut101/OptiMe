# Weekly Training Routine

The Weekly Training Routine is the foundation for day-specific training context. The backend model and API can keep the existing schedule naming for compatibility, but user-facing mobile copy should say Weekly Routine.

## Scope

- A routine contains seven days, Monday through Sunday.
- Each day can be a training day or a rest day.
- Training days can inherit general training setup or customize target muscles, environment, available equipment, duration, and protocol preference.
- Rest days are treated as recovery context and should not generate a normal strength workout.
- Disabling training through app mode does not delete saved training preferences or weekly routine settings.
- Preferred training days are not shown as a separate Training Setup field. The routine itself is the visible source of truth for days.
- Duration belongs to each routine day. A global/default duration may exist only as a fallback.

## Environment vs Equipment

Environment and equipment are intentionally separate.

- Environment is context: `HOME`, `GYM`, or `OUTDOOR`.
- Equipment is a hard filter for exercise selection.
- `HOME + BARBELL` is valid when the user explicitly has a barbell at home.
- `GYM` does not automatically add `BARBELL`; the user must select it.
- `BARBELL` remains available in the day-specific equipment selector because it exists in the shared `ExerciseEquipment` enum.

## Daily Plan Integration

Daily plan generation resolves the active routine day before selecting exercises.

- `NUTRITION_ONLY` skips exercise selection and returns a safe rest-style training block.
- `NUTRITION_AND_TRAINING` can use the resolved day to filter exercises by target muscles, equipment, duration, and rest-day status.
- Existing daily plans are not mutated when app mode or weekly routine changes.
- Future daily plans receive the updated context.

## Safety

Safety is not paywalled and is not bypassed by schedule settings.

- Pregnancy/postpartum context, safe mode, and minor-user rules still apply.
- Pain or limitation checks happen as a pre-workout check when starting the current workout session. They are not a global Training Setup field.
- Rest days do not generate normal strength workouts.
- Equipment filtering is deterministic before AI wording is considered.

## Deferred

- Rest timers.
- AI-generated weekly routines.
- Exercise media expansion beyond the current library-backed plan details flow.
