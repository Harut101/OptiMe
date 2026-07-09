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

## Visual Direction Update

The next visual pass refined the primitives around typed light/dark theme tokens and semantic health colors. Existing screens continue to use the same product behavior, but shared cards, pills, fields, buttons, and app surfaces now use a softer premium card system.

Semantic usage:

- Nutrition uses mint/green.
- Training uses blue.
- Recovery uses lavender.
- Health/wearable uses soft red/pink.
- Danger is reserved for true errors.

Expo Go QA then tuned color intensity upward: accents are more confident, selected states are easier to see, and metric/status highlights are clearer while the card system remains calm and low-noise.

## Today Dashboard Progress

Today now starts with an at-a-glance dashboard before the existing plan cards:

- Nutrition progress card: a circular progress ring based on tracked planned meals and the current structured food log.
- Training progress card: a circular progress ring based on the current workout session progress when available.
- Wearable summary card: compact steps, sleep, active calories, and workout minutes from the existing wearable snapshot.

This is a mobile presentation change only. It does not change nutrition formulas, workout generation, exercise selection, Health Connect sync, WHOOP, Apple Health native behavior, or backend planning logic.

## Electric Ring Tuning

The Today progress rings were tuned after Expo Go feedback that the first pass felt too pastel. The updated rings use thicker rounded arcs, segmented color interpolation, subtle mint/blue tracks, and a small end-cap dot for partial progress.

- Nutrition moves from aqua/mint into electric teal and lime.
- Training moves from electric blue/violet into magenta and Apple Health pink.
- Rest day keeps a calm blue accent and a strong center label, not a warning color.

## Screen Responsibility Matrix

Each mobile surface should answer one primary user question and avoid repeating detail owned by another screen.

| Screen | Primary question | Owns | Should not own |
| --- | --- | --- | --- |
| Today | What should I do today? | daily progress, wearable summary, plan status, generation/refresh actions, high-level nutrition/training/recovery cards | permanent usage counters, full meal details, detailed workout execution, profile setup |
| Food | What should I eat or mark complete? | nutrition target, food progress, meal cards, meal completion, menu regeneration, food preferences | wearable setup, workout history, profile settings |
| Meal Details | What is in this meal? | one meal, ingredients, prep, substitutions, meal status, meal regeneration | dashboard progress, health data, training routine |
| Training | What is my workout/routine? | today's workout/rest state, Weekly Routine, Workout History, training setup entry | nutrition targets, health provider setup, onboarding forms |
| Weekly Routine | What is my recurring training week? | weekday training/rest, muscle focus, equipment/environment/duration per day | one-off Today overrides, workout execution |
| Workout Session | What am I doing right now? | exercise execution, sets, current-session safety context, finish flow | routine editing, nutrition tracking |
| Workout History | What have I completed? | completed sessions and session summaries | live workout execution, plan generation |
| Health Data | What sources are connected and what data is available? | Apple Health status, future Health Connect/WHOOP cards, wearable snapshot | medical interpretation, plan detail duplication |
| Plan Details | What did the generated plan recommend? | generated food/training/recovery/reminders, exercises, feedback/check-ins | Today dashboard, permanent usage limits |
| Profile | Who am I and how is the app configured? | account/profile/goals/app mode/settings/connections entry points | daily progress, workout execution, meal detail |
| Onboarding | What is required for a first safe plan? | short safety-critical setup and first-plan readiness | detailed routine setup, pain/limitations, deep preferences |

Usage and plan limits should appear only when they help a decision, such as after a generation or refresh limit error. They should not be permanent Today dashboard content.

## Full Redesign v2 Screen Rules

The v2 pass applies the Apple Health-inspired system across the core mobile surfaces:

- Today is a summary dashboard with progress widgets, wearable metrics, weight progress, a compact AI Coach entry, and contextual generate/update actions.
- Food is a meal dashboard with compact meal cards and status actions.
- Meal Details opens with a focused meal hero and macro widgets.
- Training is action-oriented around today's workout/rest state, weekly routine, setup, and workout history.
- Health uses compact provider cards for Apple Health, Health Connect, WHOOP, and Garmin plus wearable metric widgets.
- Profile is a stacked settings hub with account/profile, goal/nutrition, weight, training, connections, plan/settings, support, and safety cards. It routes to domain screens instead of duplicating dashboard content.
- Auth screens use a brand mark, stronger title hierarchy, and carded inputs.

Do not add permanent usage clutter to Today. Do not show raw debug, protocol, AI, or provider internals in mobile UI.

## Unified Feedback Pattern

Food, Meal Details, Training, and Profile now use a shared feedback pattern:

- `AppToast` for compact success/info feedback such as saved preferences, meal status updates, and regenerated meals.
- `AppFeedbackSheet` for confirmations such as replacing a meal/menu or excluding an ingredient.
- `PlanImpactPromptCard` for changes that may affect the current Daily Plan.
- Inline text or contextual cards for validation and recoverable errors.

Avoid new raw `Alert.alert` calls for food flows unless there is no existing app-level pattern that fits. Limit/usage messages should appear near the action that caused them and should not become permanent dashboard clutter.
