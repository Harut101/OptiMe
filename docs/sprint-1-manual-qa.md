# Manual QA Checklist

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
  pnpm --filter @optime/mobile start:lan -- --clear
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
- Confirm fallback plans show supportive safety-adjusted copy if triggered.

## Plan Details

- Tap View plan details.
- Confirm meals, hydration, recovery, and reminders appear.
- Confirm the back label is Today or Back, not `(tabs)`.

## Feedback

- Open Plan Details.
- Select Helpful.
- Select one tag such as Felt good.
- Tap Send feedback.
- Confirm `Thanks for the feedback` appears.
- Change to Not helpful and select Low energy.
- Send again and confirm the app still succeeds.

## Safety Behavior

- Create an adult profile with weight `90kg`.
- Try goal `REDUCE_WEIGHT`, target `80kg`, timeline `60 days`.
- Confirm the backend rejects it with supportive copy.
- Try goal `REDUCE_WEIGHT`, target `85kg`, timeline `60 days`.
- Confirm it is allowed.
- Create or test a minor profile.
- Try an aggressive weight-loss goal.
- Confirm it is converted to safe wellness behavior.
- Add nutrition preferences where a preferred food duplicates an allergy.
- Confirm the backend rejects it.
- Add high-intensity training longer than 120 minutes.
- Confirm the backend rejects it.
- Add high-intensity training with description mentioning dizziness or pain.
- Confirm the backend rejects it.

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
- No OpenAI or external AI setup is required.
