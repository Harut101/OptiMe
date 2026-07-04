# Apple Health iOS MVP

Apple Health is OptiMe's first real health-data provider. It is iOS-only and requires a development or production build with HealthKit capability enabled; Expo Go does not include the native HealthKit module.

## Scope

Implemented:

- explicit user-triggered Apple Health permission request
- read-only daily summary sync on iOS
- normalization into `WearableDailySnapshot`
- authenticated backend snapshot upsert
- Health Connections UI for connect, sync, disconnect, denied, unavailable, and no-data states
- conservative Daily Plan use through the existing wearable context

Deferred:

- Health Connect real Android sync
- WHOOP OAuth
- background sync
- provider tokens
- raw HealthKit samples
- write-back to Apple Health
- medical diagnosis or alerts

## Native Dependency

The mobile adapter uses `react-native-health` behind dynamic native-module checks.

Required native setup:

- install dependencies after pulling this batch
- create an iOS development build
- enable HealthKit entitlement
- include HealthKit usage descriptions from `apps/mobile/app.json`

The adapter returns a safe unavailable state when the native module is missing, including in Expo Go.

## iOS Build Notes

Apple Health does not work in Expo Go because Expo Go does not include the native HealthKit module used by `react-native-health`. Use an iOS development or production build for physical-device QA.

During physical iPhone QA, `react-native-health` was missing from `NativeModules` while React Native new architecture was enabled. The project keeps RN new architecture disabled for the iOS dev client until `react-native-health` is verified to work safely with it. After changing native health configuration, rebuild and reinstall the iOS development client before retesting.

The iOS native project may be generated outside this repository checkout. The source-of-truth Expo configuration is `apps/mobile/app.json`, which includes HealthKit entitlements and HealthKit usage descriptions.

## Permissions

OptiMe currently requests read-only access only for MVP activity and sleep signals:

- steps
- active energy
- exercise time / workouts
- sleep analysis

Permissions are requested only when the user taps Connect or Sync. If permission is denied, OptiMe marks the connection as needing attention and keeps the app usable.

Partial permissions are allowed. If at least one useful metric can be read, OptiMe syncs the available daily snapshot fields and leaves unavailable metrics as `null`.

Respiratory rate, resting heart rate, and HRV are intentionally not requested in the MVP permission sheet because they are more medical-looking and are not currently used in user-facing behavior. They can be added later behind an advanced recovery/training-load feature with clearer explanation.

## Snapshot Mapping

Apple Health values are normalized into `WearableDailySnapshot`:

- `source`: `APPLE_HEALTH`
- `steps`: daily step count when available
- `activeCaloriesKcal`: active energy when available
- `workoutMinutes`: exercise time when available
- `sleepMinutes`: sleep sample duration when available
- `restingHeartRateBpm`: `null` in the MVP Apple Health sync
- `hrvMs`: `null` in the MVP Apple Health sync
- `respiratoryRate`: `null` in the MVP Apple Health sync
- `recoveryScore`: `null`
- `strainScore`: `null`

Missing data remains `null`. OptiMe does not invent values or compute WHOOP-style recovery/strain from Apple Health in this MVP.

One failed metric read must not fail the whole sync. Native diagnostics log the metric name, date, and safe reason, then continue with that metric as unavailable.

## UI Behavior

After a successful sync, Apple Health shows as connected, `lastSyncAt` is formatted as user-friendly text, and the wearable snapshot card displays Apple Health-appropriate metrics:

- steps
- active calories
- sleep duration when available
- workout minutes when available

Apple Health does not provide WHOOP-style recovery score or strain, so those cards are not shown for Apple Health snapshots. If only part of the Apple Health snapshot is available, the UI shows a calm note that some metrics were unavailable for that sync.

## Generate Plan Readiness Flow

Today can launch the existing Apple Health connect/sync flow before Daily Plan generation:

- connected but stale Apple Health data: prompt with Sync now or Continue without latest data
- no connected Apple Health source on iOS: prompt with Connect Apple Health or Not now
- Expo Go or missing native module: show the safe unavailable message and allow generation without health data
- no data after sync: show a no-data state and allow retry or continue
- permission denied: show a permission-specific state and allow continue

The sync action reuses `nativeHealthService.syncAppleHealthToday`, which requests read-only MVP permissions, upserts a normalized `WearableDailySnapshot`, refreshes health queries, and then lets Daily Plan generation use the latest backend snapshot.

## Safety Boundary

Apple Health data is optional wellness context. It can gently inform activity, nutrition, and recovery context, but it must not:

- diagnose medical conditions
- create scary health warnings
- override user schedule by itself
- cause extreme nutrition changes
- block daily plan generation

When no data is available, existing profile, preferences, schedule, check-ins, and protocol behavior continue normally.

## Manual QA

1. Build an iOS development build with HealthKit enabled.
2. Open Profile -> Connections.
3. Confirm Apple Health shows as iOS-only and Health Connect remains future/provider state.
4. Tap Connect Apple Health.
5. Confirm iOS permission sheet appears.
6. Grant some permissions.
7. Confirm a sync completes or shows a no-data state without crashing.
8. Confirm `/v1/health/wearable-snapshots/today` returns source `APPLE_HEALTH` when data exists.
9. Generate a Daily Plan and confirm it remains safe and non-medical.
10. On Android or Expo Go, confirm Apple Health shows a safe unavailable state.
