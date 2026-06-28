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

## Permissions

OptiMe requests read-only access for:

- steps
- active energy
- exercise time / workouts
- sleep analysis
- resting heart rate
- HRV
- respiratory rate

Permissions are requested only when the user taps Connect or Sync. If permission is denied, OptiMe marks the connection as needing attention and keeps the app usable.

## Snapshot Mapping

Apple Health values are normalized into `WearableDailySnapshot`:

- `source`: `APPLE_HEALTH`
- `steps`: daily step count when available
- `activeCaloriesKcal`: active energy when available
- `workoutMinutes`: exercise time when available
- `sleepMinutes`: sleep sample duration when available
- `restingHeartRateBpm`: resting heart rate when available
- `hrvMs`: HRV SDNN when available
- `respiratoryRate`: respiratory rate when available
- `recoveryScore`: `null`
- `strainScore`: `null`

Missing data remains `null`. OptiMe does not invent values or compute WHOOP-style recovery/strain from Apple Health in this MVP.

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
