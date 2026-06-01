# Sprint 1 Manual QA Checklist

Use a physical iPhone with Expo Go and the backend running locally.

## Setup

- Start Postgres: `docker compose up -d postgres`
- Start backend:
  ```powershell
  $env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
  pnpm --filter @optime/api start:dev
  ```
- Set `apps/mobile/.env` to your machine LAN IP:
  ```text
  EXPO_PUBLIC_API_BASE_URL=http://192.168.10.15:3000/v1
  ```
- Start Expo:
  ```powershell
  pnpm --filter @optime/mobile start -- --clear
  ```

## Auth

- Register a new account.
- Confirm the app moves into onboarding.
- Log out from Profile.
- Log in again with the same account.

## Onboarding

- Complete Profile.
- Complete Goal.
- Complete Nutrition Preferences.
- Open Training Schedule.
- Confirm the empty state appears before adding a workout.
- Add one workout.
- Edit the workout.
- Delete and re-add a workout.
- Continue to Today.

## Today

- Confirm Today shows a no-plan state if no plan exists.
- Tap Generate today plan.
- Confirm loading text appears while generating.
- Confirm plan cards appear for nutrition, training, and recovery.
- Confirm the copy is supportive and not technical.
- Tap Regenerate mock plan.
- Confirm the button changes to Refreshing.
- Confirm `Plan refreshed` appears.
- Confirm the Updated time changes.

## Plan Details

- Tap View plan details.
- Confirm meals, hydration, and recovery actions appear.
- Confirm the back label is Today or Back, not `(tabs)`.

## Error Checks

- Stop the backend.
- Refresh Today.
- Confirm a friendly error state appears.
- Restart backend and confirm Try again recovers.

## Scope Check

- No payment UI appears.
- No WHOOP UI appears.
- No AI Coach chat appears.
- No weekly reports or analytics appear.
