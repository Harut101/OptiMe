# Recovery Guidance

OptiMe recovery guidance is wellness-oriented and non-diagnostic. It can use profile, schedule, check-ins, protocol selection, and optional wearable context.

Recovery-aware DailyPlan context now adds localized `contextNotes.recovery` when recent sleep, activity, or workout-load summaries suggest gentler recovery guidance. These notes must stay supportive and must not expose raw metrics.

## Wearable Snapshot Use

When a fresh `WearableDailySnapshot` is available, recovery copy may respond conservatively to:

- low sleep minutes
- high strain/load
- low recovery score
- recent workout minutes
- Apple Health activity/sleep context, when synced by the user

Use supportive language such as:

- "Recent wearable signals suggest keeping recovery simple today."
- "A lighter day may be helpful."
- "Choose gentle mobility if it feels comfortable."

Do not write:

- medical diagnosis
- scary HRV or heart-rate interpretation
- "you must not train"
- "your data is dangerous"

When wearable data is missing or stale, recovery should continue using saved profile, training schedule, check-ins, and deterministic protocol context.

Apple Health does not provide OptiMe-owned recovery or strain scores in this MVP. HRV, resting heart rate, and respiratory rate must not be interpreted medically.
