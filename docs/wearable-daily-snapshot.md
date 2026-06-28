# WearableDailySnapshot

`WearableDailySnapshot` is the provider-neutral daily health-data abstraction for OptiMe. Future Apple Health, Health Connect, WHOOP, manual, and mock sync paths should write into this model before Daily Plan generation reads health context.

## Stored Fields

- `userId`
- `source`: `APPLE_HEALTH`, `HEALTH_CONNECT`, `WHOOP`, `MANUAL`, or `MOCK`
- `localDate`
- `timezone`
- `steps`
- `activeCaloriesKcal`
- `workoutMinutes`
- `sleepMinutes`
- `sleepQualityScore`
- `recoveryScore`
- `strainScore`
- `restingHeartRateBpm`
- `hrvMs`
- `respiratoryRate`
- `capturedAt`

There is one row per user, source, and local date.

## Privacy Boundary

This table stores daily summary data only. It does not store raw samples, routes, detailed sleep stages, provider tokens, auth tokens, or raw provider responses.

Daily Plan debug metadata may include only:

- source
- hasRecentData
- isStale
- localDate

It must not include exact steps, sleep minutes, calories, HRV, RHR, or respiratory rate.

## Stale Behavior

A snapshot is stale when it is older than the configured freshness window or does not match the plan local date. Stale data may be mentioned as unavailable or not recent, but planning should not strongly personalize from it.

## Development Path

`POST /v1/health/wearable-snapshots/mock` creates a mock or manual snapshot for tests and local QA. It is not a real provider integration and is guarded from production unless explicitly enabled.
