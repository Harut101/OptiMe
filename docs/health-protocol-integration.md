# Health Protocol Integration

Health summaries should influence planning conservatively. They are context signals, not medical conclusions.

This document describes how Sprint 7 should later integrate health summaries with `ProtocolSelectorService`.

## Inputs

Use recent `HealthDailySummary` data when available:

- today's summary, if already synced
- yesterday's summary
- short trend window, such as 3 to 7 days

Useful fields:

- steps
- sleepMinutes
- activeEnergyKcal
- workoutCount
- workoutMinutes
- weightKg only as gentle optional context

Heart rate fields can remain optional/later.

## Protocol Effects

### Low Sleep

If recent sleep is low:

- prefer recovery-oriented protocol
- reduce training intensity
- suggest easier movement or mobility
- keep meals simple and steady
- avoid "push harder" language

### High Activity Yesterday

If yesterday had high steps, high active energy, or long workouts:

- reduce training load
- recommend recovery or maintain intensity
- avoid stacking hard sessions
- emphasize hydration and recovery

### Recent Workout

If recent workout data exists:

- avoid repeating the same muscle group too soon when known
- support post-workout recovery
- avoid unnecessary high-intensity duplication

### Low Step Trend

If a short step trend is low:

- suggest gentle walking or mobility
- avoid guilt or activity-shaming
- focus on energy, consistency, and small actions

### Weight Trend

Weight trend is sensitive and optional.

Allowed use:

- gentle context for consistency
- avoid overreacting to short-term changes
- avoid aggressive calorie changes

Disallowed use:

- body-shaming
- strict dieting pressure
- diagnosis
- unsafe weight-loss acceleration

### Missing Health Data

If health data is missing:

- existing profile, schedule, goal, check-ins, and training preferences continue to drive planning
- plan generation must not fail
- no special user warning is required

## PlanQualityMode Behavior

### BASIC

`BASIC` can show the health foundation or use very simple health context if available.

Planning remains simple:

- one conservative adjustment
- no deep trend analysis
- no advanced adaptive claims

### PERSONALIZED

`PERSONALIZED` can use simple health-aware planning:

- sleep-aware recovery
- workout-aware meal timing
- activity-aware training load

### ADAPTIVE

`ADAPTIVE` can use deeper protocol selection:

- recent health trend summary
- readiness-like interpretation without diagnosis
- more nuanced recovery/training protocol choice
- future WHOOP or wearable signals can reuse the same input boundary

Safety remains equal across all modes.

## Safety Override Rules

Health data never overrides hard safety rules.

Always prioritize:

- under-18 safeMode
- pregnancy/postpartum/breastfeeding safety
- pain/discomfort signals
- illness, dizziness, exhaustion, or injury
- dangerous weight-loss validation
- allergies and excluded foods
- training intensity boundaries

Poor recovery signals should reduce intensity. They should never be used to push harder.

## AiProvider Context

When health summaries are available, pass a compact summary to `AiProvider`.

Example:

```json
{
  "healthContext": {
    "available": true,
    "sourceProviders": ["APPLE_HEALTH"],
    "yesterday": {
      "steps": 9300,
      "sleepMinutes": 360,
      "workoutMinutes": 50,
      "activeEnergyKcal": 520
    },
    "signals": [
      "LOW_SLEEP",
      "RECENT_WORKOUT"
    ]
  }
}
```

Do not pass raw samples.

Do not pass platform secrets.

Do not pass full permission payloads unless needed for planning.

