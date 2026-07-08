# Health Integrations

Sprint 7 prepares OptiMe for health integrations and now includes the first real provider path: Apple Health read sync on iOS.

The integration strategy is summarized-data-first: read useful daily signals on device, sync only daily summaries to the backend, and use those summaries conservatively in planning.

Apple Health is now the first real provider path. The MVP sync requests activity and sleep signals only: steps, active energy, exercise/workout minutes, and sleep. Missing metrics are represented as `null`, and one failed metric read does not fail the entire sync.

Respiratory rate, resting heart rate, and HRV remain future-ready nullable fields in `WearableDailySnapshot`, but Apple Health does not request or read them yet.

## Recovery-Aware Planning

When a recent wearable snapshot exists, backend planning derives safe wearable and training-load summaries. These summaries can influence recovery wording, controlled-intensity training guidance, and nutrition target explanations. If data is missing or stale, plan generation continues from profile, preferences, and schedule.

Mobile displays only localized context notes. It must not render raw health records, provider secrets, or debug metadata.

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
- Apple Health requires an iOS development or production build. Expo Go shows a safe unavailable state because it does not include the native HealthKit module.
- RN new architecture remains disabled for the iOS development client until `react-native-health` compatibility is verified.
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
- Health Connect, WHOOP, and Garmin remain represented but not implemented.
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

The current foundation adds a provider-neutral `WearableDailySnapshot` path for future Apple Health, Health Connect, WHOOP, Garmin, manual, and mock sources. It does not add real OAuth, native permission prompts, background sync, provider tokens, or external wearable API calls.

Backend sources:

- `APPLE_HEALTH`
- `HEALTH_CONNECT`
- `WHOOP`
- `GARMIN`
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

The mobile Health Connections screen shows foundation cards for Apple Health, Health Connect, WHOOP, and future Garmin support, plus a development-only mock snapshot action. It does not request native permissions or start OAuth.

## Official Documentation References

- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo custom native code: https://docs.expo.dev/workflow/customizing/
- Expo config plugins: https://docs.expo.dev/config-plugins/introduction/
- Expo Continuous Native Generation: https://docs.expo.dev/workflow/continuous-native-generation/
- Android Health Connect: https://developer.android.com/health-and-fitness/health-connect
- Apple HealthKit: https://developer.apple.com/documentation/healthkit

## Mobile polish

Health Connections now presents Apple Health, Health Connect, WHOOP, and future Garmin support as consistent provider cards with readable status pills, localized sync/connect/disconnect actions, and a compact wearable snapshot grid. Health Connect wording remains `Health Connect`; the app does not call it `Google Health`.

This polish does not add real Health Connect sync, WHOOP OAuth, background sync, provider tokens, or new native permission flows.

## Today wearable summary widget

Today can show a compact wearable summary from the existing `WearableDailySnapshot`:

- steps
- sleep duration
- active calories
- workout minutes
- last synced day label

The widget intentionally does not show HRV, resting heart rate, respiratory rate, raw provider payloads, or medical interpretations. If no source is connected, it shows a calm empty state with a Health Data entry point. This does not implement real Health Connect sync, WHOOP OAuth, background sync, or new native permissions.

## Generate Plan Readiness Prompt

Today now checks health data readiness before generating a Daily Plan:

- `FRESH`: a connected source has a same-local-date wearable snapshot, so generation continues immediately.
- `STALE`: Apple Health is connected but the snapshot is missing or not from the target local date, so the user can Sync now or Continue without latest data.
- `NOT_CONNECTED`: iOS users can Connect Apple Health or choose Not now.
- `DISMISSED_RECENTLY`: the no-provider prompt is suppressed locally after Not now.
- `UNAVAILABLE`: non-iOS platforms or builds without a supported native provider continue without health data.

The prompt is intentionally optional. It must not imply the plan is inaccurate without health data, and it must not block plan generation.

Provider scope remains unchanged:

- Apple Health is the only real provider path in this sprint.
- Health Connect remains represented for Android but deferred.
- WHOOP remains represented but deferred.
- Garmin remains represented as a future source only; OAuth, provider API calls, background sync, and token storage are deferred.
- No background sync, provider tokens, OAuth, or automatic app-launch sync is added.

## Health Screen Boundary

Health Data owns connection status, provider actions, and wearable snapshot visibility. Apple Health, Health Connect, WHOOP, Garmin, manual/mock states, and source-specific availability messages belong here.

Today may show a compact wearable summary and a soft readiness prompt before plan generation, but it should not duplicate the full Health Data screen. Health copy must stay non-medical and should not imply diagnosis, guaranteed recovery scoring, or plan invalidity when health data is missing.

Profile may link to Connections, but it should not show permanent provider warning text unless the user is actively managing health sources.
