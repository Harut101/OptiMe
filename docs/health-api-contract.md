# Health API Contract

This document describes the Sprint 7 health API contracts.

All endpoints require JWT authentication.

Batch 2 implemented these endpoints as backend foundation. Batch 3 added mobile status/consent UI. Batch 4B added an Android-first native Health Connect sync spike. Batch 5 integrated stored summaries into conservative protocol selection.

Batch 3 mobile uses:

- `GET /v1/health/status`
- `POST /v1/health/connect`
- `POST /v1/health/disconnect`
- `DELETE /v1/health/data`

Native sync uses `POST /v1/health/daily-summary` from the Android development-build spike. Manual summary sync remains useful for development/testing. Production background sync is still deferred.

## GET /v1/health/status

Returns current health connection status for the authenticated user.

Response:

```json
{
  "connections": [
    {
      "provider": "APPLE_HEALTH",
      "status": "CONNECTED",
      "consentedAt": "2026-06-13T10:00:00.000Z",
      "disconnectedAt": null,
      "lastSyncAt": "2026-06-13T10:05:00.000Z",
      "permissionsGranted": {
        "steps": true,
        "sleep": true,
        "workouts": true,
        "activeEnergy": true,
        "weight": false
      },
      "errorReason": null
    }
  ]
}
```

If no saved connection exists, the response still includes known providers with disconnected/default status.

```json
{
  "connections": [
    {
      "provider": "APPLE_HEALTH",
      "status": "DISCONNECTED",
      "consentedAt": null,
      "disconnectedAt": null,
      "lastSyncAt": null,
      "permissionsGranted": null,
      "errorReason": null
    },
    {
      "provider": "HEALTH_CONNECT",
      "status": "DISCONNECTED",
      "consentedAt": null,
      "disconnectedAt": null,
      "lastSyncAt": null,
      "permissionsGranted": null,
      "errorReason": null
    }
  ]
}
```

## POST /v1/health/connect

Records user consent and provider connection status.

Request:

```json
{
  "provider": "APPLE_HEALTH",
  "permissionsGranted": {
    "steps": true,
    "sleep": true,
    "workouts": true,
    "activeEnergy": true,
    "weight": false
  }
}
```

Response:

```json
{
  "provider": "APPLE_HEALTH",
  "status": "CONNECTED",
  "consentedAt": "2026-06-13T10:00:00.000Z",
  "lastSyncAt": null
}
```

## POST /v1/health/disconnect

Disconnects a provider and stops future use in planning context.

Request:

```json
{
  "provider": "APPLE_HEALTH"
}
```

Response:

```json
{
  "provider": "APPLE_HEALTH",
  "status": "DISCONNECTED",
  "disconnectedAt": "2026-06-13T10:10:00.000Z"
}
```

Disconnect does not delete previously synced summaries. Use `DELETE /v1/health/data` for deletion.

## DELETE /v1/health/data

Deletes synced health summaries for the authenticated user.

Request:

```json
{
  "provider": "APPLE_HEALTH"
}
```

Response:

```json
{
  "deleted": true,
  "provider": "APPLE_HEALTH",
  "summaryCountDeleted": 14
}
```

If provider is omitted later, the API may delete all synced health summaries for the user. Sprint 7 should start provider-specific.

## GET /v1/health/daily-summary?localDate=YYYY-MM-DD

Returns the user's summary for the requested local date.

Response when present:

```json
{
  "localDate": "2026-06-13",
  "summaries": [
    {
      "localDate": "2026-06-13",
      "timezone": "Asia/Yerevan",
      "sourceProvider": "APPLE_HEALTH",
      "steps": 7200,
      "sleepMinutes": 410,
      "activeEnergyKcal": 430,
      "workoutCount": 1,
      "workoutMinutes": 45,
      "averageHeartRate": null,
      "restingHeartRate": null,
      "weightKg": null,
      "updatedAt": "2026-06-13T10:05:00.000Z"
    }
  ]
}
```

Response when missing:

```json
{
  "localDate": "2026-06-13",
  "summaries": []
}
```

Missing data is not an error.

## POST /v1/health/daily-summary

Development/manual sync endpoint for Sprint 7 testing.

Request:

```json
{
  "localDate": "2026-06-13",
  "timezone": "Asia/Yerevan",
  "sourceProvider": "APPLE_HEALTH",
  "steps": 7200,
  "sleepMinutes": 410,
  "activeEnergyKcal": 430,
  "workoutCount": 1,
  "workoutMinutes": 45,
  "weightKg": null
}
```

Response:

```json
{
  "summary": {
    "localDate": "2026-06-13",
    "timezone": "Asia/Yerevan",
    "sourceProvider": "APPLE_HEALTH",
    "steps": 7200,
    "sleepMinutes": 410,
    "activeEnergyKcal": 430,
    "workoutCount": 1,
    "workoutMinutes": 45,
    "updatedAt": "2026-06-13T10:05:00.000Z"
  }
}
```

This endpoint is used by the Android foreground sync spike and remains useful for development/manual testing. It is not a background sync or dashboard endpoint.

This endpoint requires an existing `CONNECTED` `HealthConnection` for the same provider. If the provider is not connected, the API returns:

```json
{
  "code": "HEALTH_PROVIDER_NOT_CONNECTED",
  "message": "Connect this health provider before syncing health summaries."
}
```

## Native Sync Status

Sprint 7 does not add a separate bulk sync endpoint. The Android foreground `Sync now` spike posts daily summaries through `POST /v1/health/daily-summary`.

Future production sync may add a bulk endpoint, but it should still:

- accept daily summaries, not raw samples
- validate ownership through JWT
- upsert by `userId + localDate + sourceProvider`
- update connection `lastSyncAt`
- reject raw samples

## Error Behavior

- `401 Unauthorized`: missing or invalid JWT.
- `403 Forbidden`: authenticated user attempts to access another user's health data. This should generally be impossible because user ID comes from JWT.
- `400 Bad Request`: invalid provider, invalid date, invalid timezone, invalid numeric range, unsupported permission.
- `409 Conflict`: provider state conflict if needed.

Validation rules:

- `localDate` must be `YYYY-MM-DD`.
- `timezone` must be `UTC` or an IANA-style timezone string.
- `steps`: 0 to 100000.
- `sleepMinutes`: 0 to 1440.
- `activeEnergyKcal`: 0 to 10000.
- `workoutCount`: 0 to 20.
- `workoutMinutes`: 0 to 1440.
- `averageHeartRate`: 30 to 220.
- `restingHeartRate`: 30 to 220.
- `weightKg`: 20 to 400.
- `permissionsGranted` can include only known boolean permission keys.

Planning behavior:

- missing health summary returns an empty `summaries` array
- disconnected provider means health data is not used
- health API errors should not block daily plan generation
- Batch 5 planning context excludes `weightKg`, `averageHeartRate`, and `restingHeartRate`
