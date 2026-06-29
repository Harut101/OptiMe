# UI/UX Polish

This polish pass keeps OptiMe's existing product behavior intact while making the core mobile flows feel more consistent, calm, and production-ready.

## Shared primitives

The mobile app now uses a small presentation layer for repeated patterns:

- `ScreenHeader` for page title/subtitle hierarchy.
- `SectionHeader` for card section labels and supporting copy.
- `StatusPill` for readable, non-color-only status labels.
- `ContextNoteCard` for supportive safety, recovery, usage, and success notes.
- `MetricCard` for compact health snapshot values.

These primitives use existing tokens from `apps/mobile/src/theme/colors.ts` and do not introduce a new UI framework.

## Screen hierarchy

- Today: high-level plan overview, usage, safety/context notes, nutrition, training, recovery, and actions.
- Food: nutrition target, meal plan, food progress, meal list, and preferences editing.
- Meal Details: meal status controls, approximate nutrition, ingredients, preparation, substitutions, and rationale.
- Training: app-mode state, weekly schedule, training preferences, and workout history entry point.
- Workout Session: session progress, safety note, exercise cards, set controls, and completed read-only state.
- Workout History: completed workout list with empty/loading/error states and clear partial-session status.
- Health Connections: provider cards for Apple Health, Health Connect, WHOOP, sync controls, and wearable snapshot metrics.
- Plan Details: tabbed food/training plan content, recovery, reminders, check-ins, and feedback.
- Profile: Personal, Health, Connections, and Settings sections with consistent entry points.

## State conventions

- Empty, loading, and error states continue to use `StateBlock` with one clear action when useful.
- Safety and recovery notes use calm supportive copy; no guilt, shame, or aggressive training language.
- Status is always text-based, not color-only.
- Health provider wording uses `Health Connect`, not `Google Health`.

## Accessibility

- Page headers and section headers expose logical heading semantics.
- New status pills include readable labels.
- Context notes expose combined title/message labels for screen readers.
- Buttons keep localized labels and existing touch target sizes.

Apple Health physical QA remains manual and paused until the user tests with a MacBook + iPhone development build.
