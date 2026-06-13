# Health Native Feasibility

Sprint 7 Batch 4A researched the safest native integration path for Apple Health / HealthKit on iOS and Health Connect on Android.

This is investigation only. No native libraries, app config permissions, development build config, or sync code were added in Batch 4A.

## Decision

Recommended path: Path A, proceed with native integration in Batch 4B, but do it as a small development-build spike with one platform at a time.

Suggested order:

1. Android Health Connect first with `react-native-health-connect` / `expo-health-connect`, because the library has explicit Expo managed-app setup guidance and a config plugin path.
2. iOS HealthKit second with `@kingstinct/react-native-healthkit`, because it has explicit Expo support and config plugin guidance, but it also introduces `react-native-nitro-modules`, which should be tested carefully with Expo SDK 54 and React Native 0.81.

Do not enable background sync in Batch 4B. Start with foreground manual sync.

Batch 4B status:

- Android Health Connect spike code was added.
- iOS HealthKit remains a safe stub.
- Package metadata and Android config plugin entries were added.
- Dependencies still need local installation.
- Foreground `Sync now` was added.
- Background sync remains deferred.

## Official Docs Reviewed

- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo config plugins: https://docs.expo.dev/config-plugins/introduction/
- Expo Continuous Native Generation / prebuild: https://docs.expo.dev/workflow/continuous-native-generation/
- Apple HealthKit: https://developer.apple.com/documentation/healthkit
- Apple HealthKit authorization: https://developer.apple.com/documentation/healthkit/hkhealthstore/requestauthorization%28toshare%3Aread%3Acompletion%3A%29
- Apple HealthKit entitlement: https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_developer_healthkit
- Apple Health share usage description: https://developer.apple.com/documentation/bundleresources/information_property_list/nshealthshareusagedescription
- Android Health Connect get started: https://developer.android.com/health-and-fitness/health-connect/get-started
- Android Health Connect data types: https://developer.android.com/health-and-fitness/guides/health-connect/data-types
- Android Health Connect permissions: https://developer.android.com/health-and-fitness/guides/health-connect/develop/request-permissions

Library references reviewed:

- `@kingstinct/react-native-healthkit`: https://github.com/kingstinct/react-native-healthkit
- `react-native-health`: https://github.com/agencyenterprise/react-native-health
- `react-native-health-connect`: https://github.com/matinzd/react-native-health-connect

## Expo Feasibility

Expo Go cannot access Apple Health / HealthKit or Android Health Connect for OptiMe's needs.

Reason:

- Expo Go has a fixed native runtime.
- HealthKit and Health Connect require native code.
- Native modules not bundled into Expo Go require a custom development build.

Development builds are required for both platforms.

Expo prebuild is likely required during local/native testing because config plugins modify native projects during prebuild or EAS Build.

Config plugins are strongly preferred because OptiMe should keep Continuous Native Generation instead of committing hand-edited native project files.

## Proposed Future app.json Changes

Do not apply these in Batch 4A.

Current plugins:

```json
["expo-router", "expo-secure-store"]
```

Possible Android Batch 4B plugins:

```json
[
  "expo-router",
  "expo-secure-store",
  "expo-health-connect",
  [
    "expo-build-properties",
    {
      "android": {
        "compileSdkVersion": 35,
        "targetSdkVersion": 35,
        "minSdkVersion": 26
      }
    }
  ]
]
```

Batch 4B applied the Android plugin/config shape above.

Possible iOS Batch 4B plugins:

```json
[
  "expo-router",
  "expo-secure-store",
  [
    "@kingstinct/react-native-healthkit",
    {
      "NSHealthShareUsageDescription": "OptiMe uses optional health summaries like steps, sleep, workouts, and activity to personalize wellness plans.",
      "NSHealthUpdateUsageDescription": "OptiMe does not write health data in this version."
    }
  ]
]
```

Batch 4B did not apply iOS config. iOS remains stubbed until the HealthKit package path is validated.

If OptiMe does not write HealthKit data, Batch 4B should verify whether update/write usage can be omitted with the selected library/config plugin or whether the plugin requires it.

## iOS HealthKit Candidates

### Candidate 1: `@kingstinct/react-native-healthkit`

Pros:

- TypeScript-first HealthKit bindings.
- Explicit Expo documentation.
- Includes a config plugin.
- README states Expo usage is possible but not in Expo Go.
- Broad HealthKit coverage, including quantity, category, and workout types.
- Supports hooks and imperative APIs.

Cons / risks:

- Requires `react-native-nitro-modules`.
- Needs compatibility verification with Expo SDK 54 and current React Native version.
- HealthKit is iOS only.
- Requires physical-device testing for realistic health data.
- Authorization must happen before reading data; the README warns that reading before authorization can crash.

Fit for OptiMe:

- Best iOS candidate for Batch 4B if the Nitro dependency works cleanly in a development build.

### Candidate 2: `react-native-health`

Pros:

- Mature and widely used.
- Apple HealthKit only.
- Supports steps, active energy, weight, sleep, heart rate, and workouts through documented methods.
- Has an Expo custom dev client warning and config plugin file in the repository.

Cons / risks:

- README notes a major Swift rewrite has been in progress and new features were paused.
- More Objective-C/legacy surface.
- More manual native setup documentation.
- More open issues than the Kingstinct package.

Fit for OptiMe:

- Good fallback if `@kingstinct/react-native-healthkit` fails Expo SDK 54 / Nitro compatibility checks.

## Android Health Connect Candidates

### Candidate 1: `react-native-health-connect`

Pros:

- Dedicated Android Health Connect wrapper.
- TypeScript support.
- Supports old and new React Native architecture per README.
- Has explicit Expo installation guidance using `expo-health-connect`.
- Supports permission request flow and reading records.
- Official Android docs support aggregate reads for cumulative data like steps.

Cons / risks:

- Android only.
- Requires min SDK 26 according to the library README.
- Requires Health Connect availability: built into Android 14, app install on older supported Android versions.
- Google Play release may require Health Connect data access declaration and approval.
- Expo path appears to involve `expo-health-connect` plus `expo-build-properties`, so Batch 4B must verify package status and compatibility before installing.

Fit for OptiMe:

- Best Android candidate for Batch 4B.

### Candidate 2: Direct native Health Connect module later

Pros:

- Full control over permissions, aggregation, and platform evolution.
- Can exactly match OptiMe's summarized-data-first contract.

Cons / risks:

- More native code.
- Higher maintenance cost.
- Slower to ship.
- Less appropriate before proving the product loop.

Fit for OptiMe:

- Defer unless community library path fails.

## Data Mapping

| Native signal | Backend field | iOS reliability | Android reliability | Notes |
| --- | --- | --- | --- | --- |
| Steps | `steps` | Good via step count quantity samples | Good via `StepsRecord` aggregate | Use daily aggregate. |
| Sleep | `sleepMinutes` | Good if sleep data exists in Apple Health | Good via sleep sessions | Sum asleep intervals; avoid storing stages in MVP. |
| Workouts / exercise sessions | `workoutCount`, `workoutMinutes` | Good via workouts | Good via exercise sessions | Store count and duration only. |
| Active energy/calories | `activeEnergyKcal` | Good via active energy burned | Good via active calories burned | Normalize units to kcal. |
| Weight | `weightKg` | Available but sensitive | Available but sensitive | Disabled by default; explicit permission only. |
| Heart rate | `averageHeartRate` | Available but sensitive | Available but sensitive | Defer unless needed. |
| Resting heart rate | `restingHeartRate` | Available but sensitive | Platform/source dependent | Defer unless needed. |

Defer:

- sleep stages
- workout routes
- heart-rate time series
- HRV
- VO2 max
- blood pressure
- clinical records / medical records
- raw samples

## Permission Strategy

First permission set:

- steps
- sleep
- workouts / exercise sessions
- active energy

Disabled/deferred by default:

- weight
- heart rate
- resting heart rate

Why:

- Weight can trigger body-image pressure and needs extra care.
- Heart-rate data feels more medical and could invite accidental diagnosis.
- The first adaptive planning value can be achieved with activity, workout, and sleep summaries.

User-facing permissions should explain:

- health data is optional
- only daily summaries are synced
- raw samples are not stored by default
- OptiMe does not diagnose medical conditions
- the user can disconnect and delete synced summaries

## Sync Strategy

### Batch 4B MVP Sync

Mobile:

- User taps Connect on the Health data screen.
- App requests native permissions for the first permission set.
- If permissions are granted, app calls backend `POST /v1/health/connect`.
- App reads the last 7 local days.
- App computes one daily summary per local date.
- App posts each summary to `POST /v1/health/daily-summary`.
- App refreshes `GET /v1/health/status`.

Backend:

- Keep existing manual summary endpoint.
- Require an existing `CONNECTED` provider.
- Upsert by `userId + localDate + sourceProvider`.
- Update `lastSyncAt`.
- Do not store raw samples.

Do not add background sync in Batch 4B.

Later:

- Manual "Sync now" button.
- Sync on app open with throttling.
- Background sync only after privacy, battery, and platform behavior are understood.

## Testing Strategy

### Expo Go

Can test:

- Settings Health data card.
- Consent/explanation UI.
- Backend status/connect/disconnect/delete.
- Fallback copy when native APIs are unavailable.

Cannot test:

- native HealthKit permission prompt
- native Health Connect permission prompt
- real health summary reading

### iOS

Requires:

- development build
- physical iPhone for realistic Health data
- Health app with sample data or connected devices/apps
- app config HealthKit entitlement and Info.plist usage descriptions

Manual QA:

- install development build on physical iPhone
- open Health data screen
- request permissions
- deny permissions and verify safe state
- grant steps/sleep/workouts/active energy
- sync last 7 days
- verify backend summaries
- disconnect
- delete synced data

### Android

Requires:

- development build
- Android device or emulator with Health Connect available
- Android 14 uses framework Health Connect
- Android 13 and lower may require Health Connect app
- declared Health Connect permissions

Manual QA:

- confirm Health Connect availability
- request permissions
- deny permissions and verify `PERMISSION_DENIED` style UI
- grant steps/sleep/exercise/active calories
- sync last 7 days
- verify backend summaries
- disconnect
- delete synced data

## User-Facing Copy Review

Current Batch 3 copy is safe because it says:

- health data is optional
- native permissions and real sync are not active yet
- daily summaries are stored first, not raw samples
- this is not medical advice

Recommended Batch 4B copy adjustment when native sync is added:

"OptiMe can request permission to read steps, sleep, workouts, and activity from {provider}. If you allow it, OptiMe syncs daily summaries only. You can disconnect or delete synced summaries anytime."

Do not say:

- "automatic recovery scoring"
- "diagnosis"
- "medical-grade"
- "we detect health problems"
- "you must connect health data"

## Risks And Mitigations

- Risk: library incompatibility with Expo SDK 54 or React Native 0.81.
  Mitigation: one-platform spike first, small branch, development build only.
- Risk: app config changes break Expo Go expectations.
  Mitigation: keep Expo Go fallback UI and clearly document dev build requirement.
- Risk: Health Connect Play declaration delays release.
  Mitigation: treat Android native sync as development-only until declaration requirements are understood.
- Risk: HealthKit permission copy is too broad.
  Mitigation: request only read permissions needed and avoid write permissions if possible.
- Risk: data interpretation becomes diagnostic.
  Mitigation: summarize only and use conservative planning language.
- Risk: background sync adds privacy/battery complexity.
  Mitigation: defer background sync.

## Batch 4B Recommendation

Proceed with Path A:

- Implement native integration spike using selected libraries/config plugins.
- Start with Android Health Connect if we want the lowest Expo setup ambiguity.
- Add iOS HealthKit immediately after Android if the selected iOS library works with SDK 54.
- Keep the feature behind platform availability checks.
- Add "Sync now" foreground action only.
- Sync last 7 days into `HealthDailySummary`.

If Android package compatibility fails, switch to iOS first with `@kingstinct/react-native-healthkit`.

If both library paths are unstable, fall back to Path B and keep manual summary sync until a safer native-module path is selected.
