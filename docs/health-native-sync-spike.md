# Health Native Sync Spike

Sprint 7 Batch 4B adds a small foreground native health sync spike.

This is not production-grade native integration yet. It is a development-build spike designed to prove the end-to-end path:

1. request native health permissions
2. read summarized health data
3. post daily summaries to the backend
4. keep Expo Go safe

## What Was Added

- Mobile native health abstraction:
  - `native-health.types.ts`
  - `native-health.service.ts`
  - `native-health.android.ts`
  - `native-health.ios.ts`
  - `native-health.fallback.ts`
- Android Health Connect adapter.
- iOS safe stub.
- Foreground `Sync now` action on the Health data screen.
- Defensive fallback when native modules are missing.

## Selected Android Packages

Package metadata and lockfile entries exist for:

- `react-native-health-connect`
- `expo-health-connect`
- `expo-build-properties`

After cloning, or if package metadata changes, run locally:

```powershell
pnpm install --reporter=append-only --no-frozen-lockfile --config.offline=false --registry=https://registry.npmjs.org/
```

If pnpm lockfile resolution ever needs package-specific commands instead:

```powershell
pnpm --filter @optime/mobile add react-native-health-connect@^3.5.3 expo-health-connect@^0.1.1
pnpm --filter @optime/mobile add -D expo-build-properties@~1.0.9
```

## App Config Changes

`apps/mobile/app.json` now includes:

- `expo-health-connect`
- `expo-build-properties`
- Android SDK config:
  - compile SDK 35
  - target SDK 35
  - min SDK 26

No background modes were added.

No iOS HealthKit config was added in Batch 4B.

## Expo Go Behavior

Expo Go should not crash.

If the user taps `Sync now` in Expo Go, the app should show:

"Health sync requires a development build with native health support."

Expo Go can still test:

- Health data card
- Health data screen
- backend connect/disconnect/delete
- fallback sync message

Expo Go cannot test:

- native Health Connect permission prompt
- real native health summary reading
- development-build native module behavior

## Android Implementation Status

Android is the active native spike path.

The adapter:

- checks Health Connect availability through the native module
- requests read permissions for:
  - steps
  - sleep sessions
  - exercise sessions
  - active calories burned
- reads last 7 local days
- maps native records into `HealthDailySummary`
- skips days with no data
- posts summaries to `/v1/health/daily-summary`

If one data type fails, that type is omitted rather than failing the full sync.

## iOS Implementation Status

iOS is intentionally stubbed in Batch 4B.

Behavior:

- no native HealthKit package installed
- no iOS HealthKit app config added
- `Sync now` returns the same development-build/native-support unavailable message

iOS HealthKit should be implemented in a later batch after validating `@kingstinct/react-native-healthkit` and `react-native-nitro-modules` compatibility with Expo SDK 54.

## Data Mapping

| Native data | Backend field | Batch 4B |
| --- | --- | --- |
| Steps | `steps` | Android spike |
| Sleep sessions | `sleepMinutes` | Android spike |
| Exercise sessions | `workoutCount`, `workoutMinutes` | Android spike |
| Active calories burned | `activeEnergyKcal` | Android spike |
| Weight | `weightKg` | Deferred |
| Heart rate | `averageHeartRate` | Deferred |
| Resting heart rate | `restingHeartRate` | Deferred |

## Sync Flow

1. User opens Health data screen.
2. User taps `Sync now`.
3. App checks native availability.
4. If unavailable, app shows safe unavailable copy.
5. If available, app requests native permissions.
6. If no core permissions are granted, app shows a friendly denied message.
7. If at least one core permission is granted, app calls `POST /v1/health/connect`.
8. App reads last 7 local days.
9. App posts summaries to `POST /v1/health/daily-summary`.
10. App refreshes `GET /v1/health/status`.

## Privacy Rules

- No raw native samples are stored.
- No raw native samples are logged.
- Weight is not requested.
- Heart rate is not requested.
- Resting heart rate is not requested.
- Background sync is not enabled.
- Health data remains optional and non-blocking.

## Android Development Build Steps

After installing dependencies:

```powershell
pnpm --filter @optime/mobile typecheck
```

Then create a development build. If using EAS:

```powershell
pnpm --filter @optime/mobile exec eas build --profile development --platform android
```

If using local native build flow:

```powershell
pnpm --filter @optime/mobile exec expo prebuild --platform android
pnpm --filter @optime/mobile android
```

Do not commit generated native folders unless the team intentionally switches workflow.

## Manual QA

Expo Go:

- open Health data screen
- tap `Sync now`
- confirm friendly development-build-required message
- confirm app does not crash

Android development build:

- open Health data screen
- tap `Sync now`
- confirm Health Connect permission prompt appears
- deny permissions and confirm safe message
- grant steps/sleep/workout/activity permissions
- confirm "Health summaries synced."
- verify rows in `HealthDailySummary`
- disconnect provider
- delete synced health data
- confirm Today and Plan Details do not change

## Known Limitations

- Android record shape may need small adjustment after physical-device testing.
- iOS HealthKit is not implemented yet.
- No background sync.
- No charts.
- No protocol integration.
- No daily-plan integration.
- No production Play Store Health Connect declaration work yet.
