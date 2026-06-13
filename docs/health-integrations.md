# Health Integrations

Sprint 7 prepares OptiMe for Apple Health and Health Connect without adding native implementation yet.

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

## Official Documentation References

- Expo development builds: https://docs.expo.dev/develop/development-builds/introduction/
- Expo custom native code: https://docs.expo.dev/workflow/customizing/
- Android Health Connect: https://developer.android.com/health-and-fitness/health-connect
- Apple HealthKit: https://developer.apple.com/documentation/healthkit
