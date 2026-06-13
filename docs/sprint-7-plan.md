# Sprint 7 Plan

Sprint 7 adds the Apple Health / Health Connect foundation for safer adaptive planning.

This sprint is foundation-first. Health data is optional, consent-based, summarized, and non-blocking. OptiMe must continue generating daily plans when no health data is connected.

## Goals

- Add architecture for Apple Health on iOS and Health Connect on Android.
- Define consent, privacy, disconnect, and delete-data behavior before implementation.
- Store daily health summaries first, not raw samples.
- Prepare backend contracts for connection status and daily summaries.
- Prepare mobile UX for health connection and permission explanation.
- Prepare `ProtocolSelectorService` to use health summaries conservatively.
- Keep health data out of medical diagnosis and body-shaming language.
- Keep safety equal across all tiers.

## Delivered Scope

- Documentation and contracts.
- Expo/native feasibility analysis.
- Prisma health connection and daily summary models.
- Backend health REST APIs.
- Mobile health status, consent, disconnect, and delete-data UI.
- Android-first Health Connect native sync spike.
- Expo Go safe fallback.
- iOS safe stub.
- Privacy and consent requirements.
- Conservative protocol integration.
- Test coverage for backend health APIs and planning behavior.

## Out Of Scope

- Production native health rollout.
- iOS HealthKit native implementation.
- Background health sync.
- Health charts or dashboard.
- WHOOP integration.
- Real payments.
- App Store / Google Play purchase flow.
- AI Coach chat.
- Embeddings.
- Admin or web.
- ExerciseLibrary.
- Exercise media.

## Why Apple Health / Health Connect Before WHOOP Or Payments

Apple Health and Health Connect cover broader user populations than WHOOP alone. They can provide steps, sleep, workouts, active energy, and optional weight data from many apps and devices.

This strengthens the core daily planning loop before asking users to pay. It also creates the privacy, consent, summary-sync, and protocol-integration foundation that future WHOOP and Pro features can reuse.

The goal is not to add medical interpretation. The goal is to make OptiMe more context-aware:

- poor sleep -> easier recovery day
- high activity yesterday -> lower training load
- recent workout -> avoid repeated overload
- low activity trend -> gentle movement suggestion
- future weight trend -> gentle context only, if explicitly approved later

## Implementation Batches

### Batch 1: Architecture, Docs, And Contracts

- Add Sprint 7 planning docs.
- Add health integration feasibility notes.
- Define proposed backend models and API contracts.
- Define privacy and consent rules.
- Define protocol integration behavior.

### Batch 2: Backend Health Foundation

- Add `HealthModule`.
- Add `HealthConnection` and `HealthDailySummary` models.
- Add connect, disconnect, status, delete-data, and manual summary endpoints.
- Keep native sync out of scope.
- Add e2e tests for ownership, validation, and non-blocking behavior.

Batch 2 implementation status:

- Implemented backend health module and protected REST endpoints.
- Implemented Prisma models and migration `add_health_integration_foundation`.
- Implemented development/manual summary upsert endpoint.
- Native Apple Health / Health Connect sync remains deferred.
- Mobile UI remains deferred to Batch 3.
- Protocol integration remains deferred to Batch 5.

### Batch 3: Mobile Health Foundation UI

- Add Settings health card.
- Add permission explanation screen.
- Show connection status.
- Add disconnect and delete synced data actions.
- Add platform stubs if native sync is still deferred.

Batch 3 implementation status:

- Mobile Settings/Profile now shows a Health data card.
- Mobile has a Health data screen with privacy-first explanation, connect, disconnect, and delete synced data actions.
- Connect calls the backend consent/status endpoint only.
- No native Apple Health / Health Connect permissions are requested yet.
- No real health samples or summaries are synced yet.
- Today and Plan Details remain unchanged.

### Batch 4: Native Integration Spike

- Evaluate iOS HealthKit library path.
- Evaluate Android Health Connect library path.
- Confirm development build requirements.
- Confirm config-plugin/native module requirements.
- Read summarized data on device where feasible.
- Keep backend sync summarized.

Batch 4A feasibility status:

- Added `docs/health-native-feasibility.md`.
- Confirmed Expo Go is not suitable for native HealthKit / Health Connect.
- Confirmed development builds and config plugins are the likely path.
- Recommended Path A for Batch 4B: native integration spike with selected libraries, foreground "Sync now", and last-7-days summaries only.
- No packages, app config, native permissions, or sync code were added in Batch 4A.

Batch 4B spike status:

- Android Health Connect native abstraction and foreground `Sync now` flow added.
- iOS HealthKit adapter remains a safe unavailable stub.
- App config now includes Android Health Connect plugin/build-property entries for development builds.
- Dependencies and lockfile entries are listed for the Android native spike.
- No background sync, charts, health-to-protocol integration, or daily-plan integration was added.

Batch 5 protocol integration status:

- Stored `HealthDailySummary` rows are summarized into a compact planning context.
- `ProtocolSelectorService` uses low sleep, high activity yesterday, recent workout, and low step trend conservatively.
- Health summaries are optional and missing data does not block daily plan generation.
- `DailyPlansService` passes safe health context to `AiProvider` through personalization context.
- Daily plan debug metadata stores only safe health signal booleans.
- Weight, average heart rate, and resting heart rate are not used for planning in Batch 5.
- Safety-sensitive rules remain above health signals.

### Batch 5: Protocol Integration

- Load recent health summaries for planning context.
- Integrate health summaries into `ProtocolSelectorService`.
- Keep health effects conservative.
- Ensure under-18, pregnancy/postpartum, and pain/discomfort rules override health context.
- Add safety and e2e tests.

Batch 5 implementation status:

- Implemented health planning context retrieval from recent summaries.
- Implemented conservative protocol selection from health signals.
- Implemented health context handoff to `AiProvider`.
- Implemented safe `debug.healthSignals` metadata.
- Added tests for no health data, safety override ordering, AI provider context, and safe field exclusion.

### Batch 6: QA And Closure

- Run API build, e2e tests, and mobile typecheck.
- Add smoke test docs.
- Add manual QA checklist.
- Close Sprint 7 and plan Sprint 8.

## Acceptance Criteria

- Health data is optional and never blocks daily plan generation.
- Health connection requires explicit user consent.
- Backend stores daily summaries first, not raw samples.
- Users can disconnect health access.
- Users can delete synced health summaries.
- Missing health summaries return empty/null data, not hard errors.
- Users can access only their own health connection and summaries.
- `ProtocolSelectorService` uses health summaries conservatively when available.
- Poor recovery signals reduce intensity rather than pushing harder.
- Under-18 safeMode overrides health-based suggestions.
- Pregnancy/postpartum/breastfeeding safety overrides health-based suggestions.
- Health data is not used for medical diagnosis.
- No body-shaming or activity-shaming language is introduced.
- Expo/native feasibility is documented before library installation.

## Risks And Mitigations

- Risk: Expo Go cannot use required native APIs.
  Mitigation: Use development builds and config plugins/native modules after feasibility review.
- Risk: Native libraries are poorly maintained.
  Mitigation: Evaluate library health, platform coverage, config-plugin support, and Expo compatibility in Batch 4 before installing.
- Risk: Health data feels invasive.
  Mitigation: Make connection optional, explain usage clearly, request granular permissions, and provide disconnect/delete controls.
- Risk: Raw health samples increase privacy risk.
  Mitigation: Store daily summaries first and defer raw samples.
- Risk: Health data creates unsafe coaching.
  Mitigation: Use deterministic protocol rules, avoid diagnosis, and keep SafetyService/Safety Agent in the plan pipeline.
- Risk: Low activity or weight trend creates shame.
  Mitigation: Use supportive language focused on energy, recovery, and small practical actions.
- Risk: Health data becomes a paywalled safety feature.
  Mitigation: Safety remains equal across all tiers. Tiering only changes personalization depth.
