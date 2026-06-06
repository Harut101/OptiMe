# Safety UX

Sprint 5 Batch 6 adds user-facing safety polish without changing product scope or provider behavior.

## Global Disclaimer

Mobile shows a lightweight safety notice in first-run profile onboarding and in Settings:

```text
OptiMe is an AI wellness assistant, not a medical service. It does not diagnose or treat medical conditions. For injuries, pregnancy/postpartum concerns, medical symptoms, or major lifestyle changes, consider consulting a qualified professional.
```

This is informational only. It does not block onboarding and does not replace backend safety rules.

## Safety Notes On Plans

Today and Plan Details show a Safety note when:

- `DailyPlan.status = FALLBACK`.
- `plan.safety.adjustedForSafety = true`.

The app uses `plan.safety.userSafeMessage` when present. If it is missing, mobile maps safety reasons to friendly fallback copy.

Mobile must never render:

- `plan.debug`
- raw `fallbackReason`
- raw provider errors
- raw Safety Agent reason codes
- raw JSON

## Goal Setup Errors

When backend rejects an unsafe goal, mobile stays on the Goal screen and shows supportive copy. Aggressive weight-loss errors should not feel punitive or body-focused.

Example:

```text
Let's choose a steadier goal that supports energy, training, and recovery.
```

## Check-In Safety Copy

If the user marks pain or discomfort during a training check-in, mobile shows:

```text
Thanks for letting us know. We'll use this to keep future training guidance more conservative.
```

This is not medical advice and should not diagnose or treat symptoms.

## Backend Contract

`DailyPlanJson.safety` is backward-compatible:

```ts
safety: {
  safeMode: boolean;
  adjustedForSafety: boolean;
  reasons: string[];
  userSafeMessage?: string;
}
```

The backend owns `userSafeMessage` for fallback plans. OpenAI does not need to generate it.

## Manual QA

- Open Settings and confirm the safety disclaimer appears.
- Register a new user and confirm the disclaimer appears on Profile onboarding.
- Trigger a fallback plan and confirm Today shows a Safety note.
- Open Plan Details for the fallback plan and confirm the Safety note appears.
- Confirm no debug fields or raw fallback reasons are visible.
- Try an aggressive adult weight-loss goal and confirm a friendly error appears while staying on Goal setup.
- Submit a training check-in with pain/discomfort and confirm the conservative guidance message appears.
