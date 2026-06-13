# Health Protocol Integration

Sprint 7 Batch 5 integrates stored `HealthDailySummary` rows into daily planning conservatively.

Health summaries are optional context signals. They are not medical conclusions, they do not block plan generation, and they never override deterministic safety rules.

## Planning Context

`HealthService.getRecentHealthSummariesForPlanning(userId, options)` returns a compact context:

```ts
{
  available: boolean;
  daysReviewed: number;
  latestSummary?: {
    localDate: string;
    steps?: number;
    sleepMinutes?: number;
    activeEnergyKcal?: number;
    workoutCount?: number;
    workoutMinutes?: number;
  };
  recentAverages?: {
    steps?: number;
    sleepMinutes?: number;
    activeEnergyKcal?: number;
    workoutMinutes?: number;
  };
  signals: {
    lowSleep: boolean;
    highActivityYesterday: boolean;
    recentWorkout: boolean;
    lowStepTrend: boolean;
  };
  selectionNotes: string[];
}
```

The planning context intentionally excludes:

- `weightKg`
- `averageHeartRate`
- `restingHeartRate`
- raw samples
- permission payloads
- platform tokens or secrets

## Thresholds

Current conservative signal thresholds:

- `lowSleep`: yesterday sleep is below 360 minutes.
- `highActivityYesterday`: yesterday steps are above 12,000, workout minutes are above 60, or active energy is above 900 kcal.
- `recentWorkout`: workout count or workout minutes are present in the last 1-2 local days.
- `lowStepTrend`: average steps are below 3,000 across at least 3 days with step data.

If yesterday's summary is missing, yesterday-only signals remain false rather than using older data as a substitute.

## Protocol Effects

Health signals can only make recommendations more conservative:

- low sleep selects recovery-aware training and recovery
- high activity yesterday selects recovery-aware training and recovery
- recent workout selects mobility-focused training to avoid repeated overload
- low step trend adds gentle movement language without guilt or pressure

Health data must not be used to push harder, diagnose, shame, or create strict diet pressure.

## Safety Override Order

Hard safety rules remain above health personalization:

- allergies and excluded foods
- under-18 `safeMode`
- pregnancy, postpartum, or breastfeeding context
- pain, discomfort, illness, dizziness, exhaustion, or limitations
- dangerous weight-loss validation
- training intensity and duration boundaries
- schema validation and fallback behavior

If deterministic safety says to reduce intensity or fallback, health data cannot reverse that decision.

## PlanQualityMode Behavior

Health safety is equal across all tiers.

- `BASIC`: may use summarized health signals for simple conservative protocol selection.
- `PERSONALIZED`: may use the same signals with more practical meal/training explanation.
- `ADAPTIVE`: may use the same signals with deeper adaptive explanation and history-aware context.

No tier receives unsafe encouragement to push through poor recovery.

## AiProvider Context

`DailyPlansService` passes the compact health planning context through `personalizationContext.healthPlanningContext`.

OpenAI prompt guidance:

- use health summaries conservatively
- reduce intensity for low sleep, high activity, or recent workouts
- treat low step trend as a gentle movement opportunity, never a failure
- avoid medical diagnosis
- avoid shame or pressure
- do not mention exact values unless genuinely helpful
- do not use weight or heart-rate values in Batch 5

## Debug Metadata

Daily plan debug metadata may include safe booleans only:

```json
{
  "debug": {
    "healthSignals": {
      "lowSleep": true,
      "highActivityYesterday": false,
      "recentWorkout": true,
      "lowStepTrend": false
    }
  }
}
```

Mobile must not render debug metadata.

## Missing Data

When health summaries are unavailable:

- `available` is false
- all health signals are false
- existing profile, goals, schedule, check-ins, training preferences, and protocols continue to work
- plan generation must not fail

No special user warning is required.
