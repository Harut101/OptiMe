# Recovery-Aware Daily Plan

OptiMe uses optional wearable daily summaries to make DailyPlan guidance more recovery-aware without making medical claims or blocking plan generation.

## Flow

1. `HealthService` loads the latest `WearableDailySnapshot` for the plan local date.
2. `WearablePlanningContextResolver` converts the snapshot into a safe summary.
3. `TrainingLoadContextResolver` converts that summary into conservative training-load guidance.
4. `DailyPlansService` passes the context to protocols, nutrition targets, AI providers, and Safety Agent review.
5. Generated plans are enriched with `contextNotes` for mobile display.

## Safety Rules

- Apple Health does not create fake recovery or strain scores.
- Missing or stale wearable data keeps planning profile/schedule-based.
- Low sleep, high activity, or recent workout load can only reduce or control training guidance.
- Wearable context must never push harder, diagnose, shame, or recommend training through pain.
- Nutrition targets can mention recent activity context, but Sprint scope avoids aggressive numeric changes.

## Mobile UX

Today shows a compact context note. Plan Details shows training-load and recovery notes when available. Raw metrics and debug metadata are not rendered.
