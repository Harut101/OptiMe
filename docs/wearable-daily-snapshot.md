# WearableDailySnapshot

`WearableDailySnapshot` is the provider-neutral daily health-data abstraction for OptiMe. Apple Health now writes real iOS daily summaries into this model. Future Health Connect, WHOOP, manual, and mock sync paths should use the same abstraction before Daily Plan generation reads health context.

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

## Apple Health Upsert

`POST /v1/health/wearable-snapshots` stores normalized Apple Health data.

Rules:

- authenticated users only
- backend ignores client `userId`
- source is limited to `APPLE_HEALTH` in the MVP
- nullable fields are accepted for missing permissions or unavailable data
- upsert key is user, source, and local date
- connection status is marked connected and `lastSyncAt` is updated after successful sync

Apple Health maps:

- steps -> `steps`
- active energy -> `activeCaloriesKcal`
- exercise time -> `workoutMinutes`
- sleep samples -> `sleepMinutes`
- resting heart rate -> `restingHeartRateBpm`
- HRV SDNN -> `hrvMs`
- respiratory rate -> `respiratoryRate`
- recovery/strain -> `null`

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
