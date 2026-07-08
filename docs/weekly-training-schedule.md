# Weekly Training Routine

The Weekly Training Routine is the foundation for day-specific training context. The backend model and API can keep the existing schedule naming for compatibility, but user-facing mobile copy should say Weekly Routine.

## Scope

- The routine is configured after onboarding from the Training tab.
- Onboarding can offer a shortcut to this setup when training mode is enabled, but the routine is never required for first-plan generation.
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

When a training-enabled user taps Generate Plan on a rest day, mobile asks whether they are training today. If they choose to train, the app opens the Today-only override editor and saves a `TRAINING_DAY` override for the current local date. After saving, the app returns to Today and continues the generation flow.

The recurring weekday editor remains available through the explicit Edit Weekly Routine action. User-facing copy must keep this distinction clear:

- Today only: date-specific `DailyTrainingOverride`.
- Usual Weekly Routine: repeating weekday template.

If a Daily Plan already exists for today after a routine edit, the app does not silently overwrite it. The user must explicitly refresh the plan.

## Mobile Preview

The Training tab shows Weekly Routine as compact weekday tiles. Each tile displays the day, training/rest state, primary focus, and duration when available. Tapping a tile still opens the existing weekday editor; the preview does not change schedule resolution or save behavior.

## Duration and Volume

Routine-day duration now feeds the deterministic workout volume planner. The planner estimates exercise count, set count, rest interval, and total session timing before exercise selection and AI generation. Longer routine days can therefore produce fuller library-backed workouts while still allowing safety reductions when needed.

## Safety

Safety is not paywalled and is not bypassed by schedule settings.

- Pregnancy/postpartum context, safe mode, and minor-user rules still apply.
- Pain or limitation checks happen as a pre-workout check when starting the current workout session. They are not a global Training Setup field.
- Rest days do not generate normal strength workouts.
- Equipment filtering is deterministic before AI wording is considered.

## Deferred

- Rest timers.
- AI-generated weekly routines.
- Full calendar-style one-off exception UI.
- Exercise media expansion beyond the current library-backed plan details flow.
