# Sprint 6 Manual QA Checklist

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
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000/v1
```

- Start Expo:

```powershell
pnpm --filter @optime/mobile start:lan -- --clear
```

## New User Short Onboarding

- Register a new user.
- Complete the short Stage 1 onboarding.
- Confirm required safety basics are collected.
- Confirm optional Stage 2 fields do not block first plan generation.
- Confirm gender and pregnancy/postpartum context remain respectful and optional.

## Progressive Training Preferences

- Open the progressive prompt card from Today when available.
- Save target muscle groups.
- Save available equipment.
- Save training level.
- Save limitations or pain areas.
- Save training outcome.
- Confirm answered prompts do not immediately reappear.
- Confirm skipped prompts do not immediately reappear.

## Plan Generation And Protocols

- Generate a daily plan after onboarding.
- Confirm the plan renders normally on Today.
- Confirm Today does not show protocol IDs or debug metadata.
- Confirm Today does not show exercise details.
- Confirm plan generation still works if training preferences are missing.
- Confirm plan generation still works when no training is planned.

## Plan Details Exercises

- Open Plan Details for a plan with `training.exercises`.
- Confirm `Suggested exercises` appears.
- Confirm exercise name renders.
- Confirm target muscles render when present.
- Confirm equipment renders when present.
- Confirm sets, reps, rest, or duration render when present.
- Confirm intensity cue renders when present.
- Confirm safety notes render in a subtle supportive style.
- Confirm no images, videos, animations, or ExerciseLibrary content appears.

## Backward Compatibility

- Open an old plan without `training.exercises`.
- Confirm Plan Details renders without an empty exercises section.
- Confirm meals, hydration, recovery, reminders, feedback, and check-ins still work.
- Confirm Today remains unchanged.

## Check-Ins And Safety UX

- Submit a meal check-in from Plan Details.
- Submit a training check-in.
- Tap `I felt pain or discomfort`.
- Confirm the supportive conservative-training message appears.
- Generate or view a fallback plan.
- Confirm the safety fallback note is user-friendly.
- Confirm raw debug, provider errors, protocol IDs, and Safety Agent internals are not shown.

## Usage Limit UX

- Use a Free account.
- Generate a daily plan.
- Refresh once.
- Try to refresh past the limit.
- Confirm the friendly `USAGE_LIMIT_REACHED` UX appears.
- Confirm the existing plan remains visible.

## Scope Check

- No real payment flow appears.
- No App Store / Google Play purchase UI appears.
- No WHOOP UI appears.
- No AI Coach chat appears.
- No embeddings UI appears.
- No admin or web UI appears.
- No ExerciseLibrary UI appears.
- No exercise images or videos appear.
