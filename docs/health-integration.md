# Health Signals in Exercise Selection

Exercise selection consumes only existing planning booleans: `lowSleep`, `highActivityYesterday` (mapped internally to `highActivity`), and `lowStepTrend`. Raw steps, sleep duration, weight, average heart rate, and resting heart rate are not added to selection context, debug metadata, or logs.

Low sleep and high activity reduce volume, prefer recovery/mobility, and exclude tagged high-impact candidates. Low-step trend increases accessible walking/cardio/mobility ranking without punitive catch-up language. These adjustments never override safety exclusions, and missing health data never blocks a plan.
