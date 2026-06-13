# Health API Contract

This document proposes REST API contracts for Sprint 7. It is not implementation yet.

All endpoints require JWT authentication.

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

If no connection exists:

```json
{
  "connections": []
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
  "summary": {
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
}
```

Response when missing:

```json
{
  "summary": null
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

This endpoint is for development/testing and should not be treated as a native sync replacement.

## POST /v1/health/sync

Future endpoint when native sync is ready.

Expected behavior:

- accept one or more daily summaries from the mobile app
- validate ownership through JWT
- upsert by `userId + localDate + sourceProvider`
- update connection `lastSyncAt`
- reject raw samples

## Error Behavior

- `401 Unauthorized`: missing or invalid JWT.
- `403 Forbidden`: authenticated user attempts to access another user's health data. This should generally be impossible because user ID comes from JWT.
- `400 Bad Request`: invalid provider, invalid date, invalid timezone, invalid numeric range, unsupported permission.
- `409 Conflict`: provider state conflict if needed.

Planning behavior:

- missing health summary returns `summary: null`
- disconnected provider means health data is not used
- health API errors should not block daily plan generation

