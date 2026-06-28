# Apple Health Mobile QA

Apple Health sync must be tested on an iPhone development or production build. Expo Go does not include the required native HealthKit module.

## iOS Development Build

1. Install dependencies after pulling the Apple Health batch.
2. Create an iOS development build with HealthKit capability enabled.
3. Launch OptiMe on an iPhone.
4. Sign in with a test user.
5. Open Profile -> Connections.
6. Confirm Apple Health card is visible and says it is iOS-only.
7. Tap Connect Apple Health.
8. Confirm the iOS permission sheet appears.
9. Grant at least one core permission: steps, sleep, workouts, or active energy.
10. Confirm the UI shows a synced or no-data message.
11. Confirm the Apple Health connection status updates.
12. Confirm Today can generate a plan with or without synced data.

## Denied Permission

1. Tap Connect Apple Health.
2. Deny permissions.
3. Confirm OptiMe shows a respectful permission-denied message.
4. Confirm the app does not crash.
5. Confirm the connection needs attention or remains unavailable.

## Expo Go / Missing Native Module

1. Open the app in Expo Go.
2. Open Profile -> Connections.
3. Tap Connect Apple Health or Sync Apple Health.
4. Confirm OptiMe shows the development-build-required message.
5. Confirm no backend snapshot is created.

## Android

1. Open the app on Android.
2. Confirm Apple Health is unavailable and does not request permissions.
3. Confirm Health Connect is labeled exactly `Health Connect`.
4. Confirm WHOOP remains future/provider state.

## Backend Verification

After a successful iOS sync:

- `GET /v1/health/wearable-snapshots/today` should return `source: APPLE_HEALTH`.
- `recoveryScore` and `strainScore` should remain `null`.
- Missing Apple Health values should be `null`, not invented.
- `GET /v1/health/connections` should show Apple Health connected with `lastSyncAt`.
