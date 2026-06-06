# Sprint 5 Manual QA Checklist

## New User Short Onboarding

- Register a new account.
- Confirm Profile asks for first name, gender, date of birth, height, weight, activity level, and optional pregnancy/postpartum context only when gender is female.
- Confirm the safety disclaimer appears on Profile onboarding.
- Save Profile and continue to Goal.
- Save Goal and continue to Nutrition.
- Enter at least one allergy or choose "No known food allergies".
- Continue to Training.
- Add a training item or choose "No training planned yet".
- Confirm Today appears after Stage 1 is complete.

## Gender And Pregnancy/Postpartum UI

- Select Female and confirm pregnancy/postpartum context appears.
- Select Pregnant, Postpartum, or Breastfeeding and confirm Profile saves.
- Change gender to Male, Other, or Prefer not to say and confirm pregnancy/postpartum context hides and resets.
- Confirm pregnancy/postpartum context is optional and does not block onboarding.

## Today And Progressive Prompts

- Generate a Today plan.
- Confirm usage status appears when available.
- Confirm existing plan remains visible after refresh limit errors.
- Confirm a progressive prompt card appears when one is available.
- Answer a progressive prompt and confirm the next prompt refreshes.
- Skip a progressive prompt and confirm it does not immediately reappear.

## Check-Ins

- Open Plan Details.
- Submit a meal check-in.
- Submit a training check-in.
- Tap "I felt pain or discomfort".
- Confirm this message appears: "Thanks for letting us know. We'll use this to keep future training guidance more conservative."
- Confirm no diagnosis or treatment language appears.

## Usage Limit Behavior

- On Free, generate once and refresh once.
- Try to exceed the daily limit.
- Confirm the app shows a friendly limit message, not raw JSON.
- Confirm existing plan remains visible.
- Confirm Settings shows Free / Basic and "Upgrade options coming soon."

## Safety Fallback UX

- Trigger or load a fallback plan.
- Confirm Today shows a Safety note card.
- Confirm Plan Details shows a Safety note card.
- Confirm the message is supportive and does not show raw `fallbackReason`.
- Confirm `plan.debug` is never rendered.

## Disclaimer

- Confirm disclaimer appears in Profile onboarding.
- Confirm disclaimer appears in Settings.
- Confirm it does not block onboarding.
