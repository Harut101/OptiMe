# Health Connect Production Readiness

## Scope

OptiMe supports foreground, user-initiated Health Connect sync on Android. Health data remains optional and plan generation continues when Health Connect is unavailable, denied, or empty.

This release path does not add background sync, write access, medical interpretation, WHOOP, or Garmin.

## Data Scope

The Android manifest and native permission request use the same minimum read-only scope:

- `android.permission.health.READ_STEPS`
- `android.permission.health.READ_SLEEP`
- `android.permission.health.READ_EXERCISE`
- `android.permission.health.READ_ACTIVE_CALORIES_BURNED`

OptiMe does not request weight, heart rate, Health Connect history, background access, or write permissions in this batch.

## Sync Flow

1. Check Health Connect SDK status.
2. Initialize the native module.
3. Request the four core read permissions.
4. Read at most the last seven local days.
5. Use Health Connect aggregation for cumulative steps, sleep duration, and active energy.
6. Read exercise sessions for workout count and duration.
7. Treat each metric independently. One unavailable metric becomes `null`; it does not fail the whole sync.
8. Sanitize the normalized daily summary.
9. Save `HealthDailySummary` and provider-neutral `WearableDailySnapshot` records through existing authenticated backend APIs.
10. Mark the connection `CONNECTED` after a successful or empty authorized sync. Mark it `ERROR` only when backend persistence/authentication fails.

No raw Health Connect samples, full payloads, profile data, or tokens are logged.

## Mobile Behavior

On Android development/production builds:

- Health Connect shows Connect or Sync.
- Permission denial produces a localized, non-blocking message.
- Manage opens Health Connect settings.
- Disconnect stops future OptiMe sync.
- Delete removes imported OptiMe health data through the existing API.

On iOS and web, Health Connect remains visible as an Android provider but does not expose a misleading native action.

Expo Go does not contain the native module. A custom Android development build is required.

## Android Build QA

1. Create a fresh Android development build after changing `app.json`.
2. Use Android 9 or newer with Health Connect available.
3. Open Profile > Health Data.
4. Tap Connect under Health Connect.
5. Confirm the system permission screen lists only steps, sleep, exercise, and active calories.
6. Grant one permission and deny another; confirm available metrics still sync.
7. Confirm the Health Connect connection becomes Connected.
8. Confirm the wearable snapshot displays available values and omits unavailable values.
9. Tap Manage and confirm Health Connect settings opens.
10. Disconnect and delete imported data; confirm the app remains usable.

## Play Console Release Tasks

These are release operations and cannot be completed in source code:

- Complete the Google Play Health apps declaration.
- Declare and justify every Health Connect data type.
- Complete Data Safety with the same data-use description.
- Publish a privacy policy that matches in-app permission rationale and Play Console declarations.
- Request only the minimum types used by the product.

The app must not be submitted until those declarations match the manifest and this documented scope.

## Remaining Limitations

- Android physical-device QA is still required for the generated native project and permission dialog.
- Sync is foreground and user initiated.
- There is no automatic/background refresh.
- Android 8 and older may run OptiMe but cannot use Health Connect.
- Garmin remains intentionally deferred until after the first release.

