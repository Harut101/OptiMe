# Sprint 7 Manual QA

Use this checklist for Sprint 7 health foundation, native sync spike, and conservative planning integration.

## Backend Health API

- Start API and Postgres with the test/dev database you intend to use.
- Register or log in as a test user.
- Call `GET /v1/health/status` and confirm Apple Health and Health Connect return disconnected/default status.
- Call `POST /v1/health/connect` for `HEALTH_CONNECT` and confirm status becomes `CONNECTED`.
- Call `POST /v1/health/disconnect` and confirm status becomes `DISCONNECTED`.
- Reconnect the provider before daily summary upsert.
- Call `POST /v1/health/daily-summary` with a valid local date, timezone, steps, sleep minutes, workouts, and active energy.
- Call `GET /v1/health/daily-summary?localDate=YYYY-MM-DD` and confirm the saved summary appears.
- Call `GET /v1/health/daily-summary?localDate=YYYY-MM-DD` for a missing date and confirm it returns an empty `summaries` array.
- Upsert the same user/date/provider again and confirm the row updates rather than duplicates.
- Add summaries for two providers, then call `DELETE /v1/health/data` with one provider and confirm only that provider's summaries are removed.
- Confirm users cannot read, update, or delete another user's health data.
- Confirm invalid summary ranges return validation errors.

## Mobile Health UI

- Open Settings/Profile and confirm the Health data card is visible.
- Open the Health data screen and confirm the privacy/permission explanation is clear.
- Confirm the screen explains health data is optional and not medical advice.
- Use the connect foundation flow and confirm status updates.
- Use disconnect and confirm status updates without deleting summaries.
- Use delete synced data and confirm summaries are deleted.
- Confirm Today screen remains unchanged.
- Confirm Plan Details remains unchanged.
- Confirm no raw health debug data appears anywhere in mobile UI.

## Native Sync Spike

- In Expo Go, tap `Sync now` and confirm the app shows a development-build-required message.
- In an Android development build, open Health data and tap `Sync now`.
- Confirm Health Connect permission request appears for the supported summary data types.
- Grant permissions and confirm foreground sync posts recent daily summaries.
- Confirm only last-7-days style summaries are synced.
- Confirm no raw samples are displayed or synced.
- Confirm `lastSyncAt` updates after successful sync.
- Confirm iOS shows the safe unavailable/stub state.
- Confirm no background sync runs.

## Planning Integration

- Generate a daily plan with no health data and confirm plan generation works.
- Sync or manually insert low sleep summary for yesterday and confirm planning leans recovery-aware.
- Sync or manually insert high activity yesterday and confirm the plan avoids aggressive training.
- Sync or manually insert a recent workout and confirm training is conservative or mobility-aware.
- Sync at least 3 low-step days and confirm the plan uses gentle movement language without shame.
- Submit pain/discomfort check-in and confirm it overrides health signals.
- Test an under-18 user and confirm `safeMode` overrides health signals.
- Test pregnancy/postpartum/breastfeeding context and confirm it overrides health signals.
- Confirm health signals never recommend pushing through pain, dizziness, illness, exhaustion, or poor recovery.

## Debug And Privacy Checks

- Inspect a generated plan row and confirm `debug.healthSignals` contains booleans only.
- Confirm `debug.healthSignals` does not contain steps, sleep minutes, calories, workouts, weight, or heart-rate values.
- Confirm `AiOperationLog` does not store prompts, raw health summaries, raw OpenAI responses, tokens, or private health data.
- Confirm mobile does not render debug metadata.

## Regression Checks

- Register/login still works.
- Short onboarding still works.
- Daily plan generation still works without health connection.
- Usage limit UX still works.
- Safety fallback UX still works.
- Suggested exercises still render in Plan Details when present.
