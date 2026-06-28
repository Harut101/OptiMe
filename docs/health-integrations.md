# Health Integrations

Sprint 7 prepares OptiMe for health integrations and now includes the first real provider path: Apple Health read sync on iOS.

The integration strategy is summarized-data-first: read useful daily signals on device, sync only daily summaries to the backend, and use those summaries conservatively in planning.

## Platform Overview

### iOS: Apple Health / HealthKit

Apple Health data is accessed through HealthKit. The app must request user authorization for specific read types before accessing data.

Initial iOS target data:

- steps
- sleep
- workouts / exercise sessions
- active energy
- weight, only with explicit permission
- heart rate and resting heart rate later or optional

### Android: Health Connect

Health Connect is Android's health and fitness data layer. It supports permissions and data types such as steps, sleep, exercise sessions, calories, and heart rate.

Android 14 includes Health Connect as a system component. Older supported Android versions may require the Health Connect app.

Initial Android target data:

- steps
- sleep
- exercise sessions
- active calories / active energy equivalent
- weight, only with explicit permission
- heart rate and resting heart rate later or optional

## Expo Feasibility

Expo Go is not expected to support native HealthKit or Health Connect access because Expo Go has a fixed native runtime. Native libraries not included in Expo Go require a development build.

Safest Expo path:

- keep Expo app architecture
- use development builds for native health APIs
- use config plugins where available
- avoid directly committing generated native folders unless the project intentionally changes native workflow
- evaluate libraries before installation

Batch 4 should evaluate:

- maintenance status
- Expo config-plugin support
- TypeScript support
- iOS HealthKit permission and query coverage
- Android Health Connect permission and query coverage
- behavior on physical devices
- development build requirements
- privacy manifest / platform metadata needs

Do not install health libraries until the feasibility spike.

Batch 4A feasibility result:

- Expo Go cannot support the required native health modules.
- Development builds are required.
- Config plugins are the preferred path.
- `react-native-health-connect` / `expo-health-connect` is the leading Android candidate.
- The Apple Health MVP uses `react-native-health` behind safe native-module checks.
- See `docs/health-native-feasibility.md` for full details.

Batch 4B native spike result:

- Android Health Connect adapter added behind a native health abstraction.
- `Sync now` action added to the Health data screen.
- Expo Go remains safe and shows a development-build-required message.
- iOS HealthKit remains stubbed and unavailable until a later batch.
- No background sync, charts, protocol integration, or daily-plan integration was added.
- See `docs/health-native-sync-spike.md` for setup and QA steps.

Batch 5 protocol integration result:

- Stored `HealthDailySummary` rows are summarized for planning.
- `ProtocolSelectorService` can use low sleep, high activity yesterday, recent workout, and low step trend signals conservatively.
- Health summaries are optional and never block plan generation.
- Health signals can reduce intensity or suggest recovery, but they must not push the user harder.
- Weight, average heart rate, and resting heart rate are not passed into planning context in Batch 5.
- Daily plan debug metadata stores only safe health signal booleans.
- See `docs/health-protocol-integration.md` for the implemented planning contract.

Apple Health iOS MVP result:

- Apple Health is available only on iOS development/production builds with HealthKit enabled.
- Expo Go and non-iOS platforms show safe unavailable states.
- The mobile app requests read-only Apple Health permissions only after explicit user action.
- Synced daily Apple Health data is normalized into `WearableDailySnapshot`.
- Recovery and strain scores remain `null`; OptiMe does not invent WHOOP-style scores from Apple Health.
- Health Connect and WHOOP remain represented but not implemented.
- See `docs/apple-health-integration.md` and `docs/apple-health-mobile-qa.md`.

## Batch 3 Mobile Foundation

Batch 3 adds mobile UI only:

- Settings/Profile Health data card
- Health data explanation screen
- backend connect/disconnect/delete synced data actions
- platform provider label, Apple Health on iOS and Health Connect on Android

Batch 3 does not:

- request native Apple Health permissions
- request native Health Connect permissions
- install native health libraries
- create a development build config
- sync real health samples
- show charts or analytics

The mobile connect action stores consent/status with the backend foundation only. Native sync remains Batch 4.

Batch 4A did not add native sync. Batch 4B should be a development-build spike, not production rollout.

## Initial Data Types

Sprint 7 should start with daily summaries:

- steps
- sleep minutes
- workout count
- workout minutes
- active energy kcal
- weight kg, only with explicit permission

Optional or later:

- average heart rate
- resting heart rate
- workout type breakdown
- sleep stage breakdown
- distance
- floors climbed

## Why Raw Samples Are Deferred

Raw samples can include sensitive, high-volume, and highly personal data. They also increase storage, deletion, attribution, and privacy complexity.

Sprint 7 should not store raw samples by default.

Use daily summaries first because they are:

- enough for conservative protocol selection
- easier to explain to users
- easier to delete
- safer to log and test
- lower risk for privacy

## Summarized-Data-First Strategy

Mobile reads allowed health data from the platform provider and computes or sends daily summaries.

Backend stores:

- one daily summary per user/date/provider
- connection status
- permission metadata
- sync timestamps

Backend should not store:

- raw prompts
- raw health samples
- detailed sleep-stage timelines
- workout route data
- health records
- unsupported medical data

Planning should use summaries only when available. Missing summaries should not block daily plan generation.

In Batch 5, planning uses only compact health context:

- latest available summary fields: steps, sleep minutes, active energy, workout count, workout minutes
- recent averages for those same fields
- boolean signals for conservative protocol selection

Planning does not use weight, heart-rate fields, raw samples, or permission payloads.

## Health Integrations Foundation + WearableDailySnapshot

The current foundation adds a provider-neutral `WearableDailySnapshot` path for future Apple Health, Health Connect, WHOOP, manual, and mock sources. It does not add real OAuth, native permission prompts, background sync, provider tokens, or external wearable API calls.

Backend sources:

- `APPLE_HEALTH`
- `HEALTH_CONNECT`
- `WHOOP`
- `MANUAL`
- `MOCK`

Connection status is managed through `/v1/health/connections` and maps legacy `DISCONNECTED` rows to the foundation-facing `NOT_CONNECTED` state. Connection responses intentionally expose only safe metadata: source, status, connected/sync timestamps, and a short error code.

Snapshot APIs:

- `GET /v1/health/connections`
- `PATCH /v1/health/connections/:source/status`
- `GET /v1/health/wearable-snapshots/today`
- `GET /v1/health/wearable-snapshots?date=YYYY-MM-DD`
- `POST /v1/health/wearable-snapshots`
- `POST /v1/health/wearable-snapshots/mock`

The non-mock snapshot endpoint is authenticated, user-owned, source-limited to the current Apple Health MVP, and accepts `null` for unavailable fields.

The mock snapshot endpoint is for development and tests. In production it is unavailable unless explicitly enabled with `ENABLE_MOCK_HEALTH_DATA=true`.

Planning remains optional:

- No snapshot: existing profile, preferences, schedule, protocol, and check-in behavior remains unchanged.
- Fresh snapshot: planning context receives compact activity/sleep/recovery/strain fields.
- Stale snapshot: planning context marks it stale and avoids overfitting.

Safe observability:

- Logs may include source, status, local date, stale/fresh, and whether wearable context was used.
- Logs must not include provider tokens, auth tokens, raw provider responses, full profiles, exact HRV/RHR values, or medical interpretations.

The mobile Health Connections screen shows foundation cards for Apple Health, Health Connect, and WHOOP, plus a development-only mock snapshot action. It does not request native permissions or start OAuth.

## Official Documentation References

- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo custom native code: https://docs.expo.dev/workflow/customizing/
- Expo config plugins: https://docs.expo.dev/config-plugins/introduction/
- Expo Continuous Native Generation: https://docs.expo.dev/workflow/continuous-native-generation/
- Android Health Connect: https://developer.android.com/health-and-fitness/health-connect
- Apple HealthKit: https://developer.apple.com/documentation/healthkit
