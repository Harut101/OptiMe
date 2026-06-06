# Sprint 5 Summary

Sprint 5 focused on activation and retention: shorten the path to the first safe plan, then collect deeper context after the user has seen value.

## What Sprint 5 Added

- Short Stage 1 onboarding for first safe daily plan.
- Backend Stage 1 readiness fields.
- Mobile short onboarding flow.
- Allergy confirmation with no-known-allergies option.
- No-training-planned intent.
- Stage 2 progressive profile prompt loop.
- Today progressive prompt card.
- Plan-to-fact check-ins.
- Meal and training check-ins in Plan Details.
- Pain/discomfort safety signal.
- Safety disclaimer in Profile onboarding and Settings.
- Friendly safety fallback UX on Today and Plan Details.
- Optional `DailyPlanJson.safety.userSafeMessage`.

## Stage 1 vs Stage 2

Stage 1 collects only what is needed for a first safe plan:

- Privacy consent.
- First name.
- Gender.
- Date of birth.
- Height.
- Weight.
- Activity level.
- Main goal.
- Weight-loss target fields only when needed.
- Allergy information or explicit no-known-allergies confirmation.
- Training schedule item or explicit no-training-planned intent.

Stage 2 collects personalization after activation:

- Preferred foods.
- Excluded foods.
- Diet type.
- Meals per day.
- Limitations or pain areas.
- Equipment.
- Training level.
- Target muscle groups.
- Cooking time, meal prep, meal timing, and training outcome.

## Progressive Prompt Loop

Today shows at most one optional progressive prompt card. Users can answer or skip. Answered prompts are not shown again. Skipped prompts use a cooldown so they do not immediately reappear.

Safety-critical questions remain prioritized. Personalization prompts never replace deterministic safety rules.

## Check-Ins

Plan Details now supports:

- Meal check-ins: Completed, Partial, Skipped, Swapped.
- Training check-ins: Completed, Partial, Skipped, Rested.
- Pain/discomfort safety signal.

Recent check-ins are summarized into future planning context so plans can become more conservative when the user reports pain, discomfort, high tiredness, or similar signals.

## Safety UX

Sprint 5 added user-facing safety polish:

- Global disclaimer: OptiMe is an AI wellness assistant, not a medical service.
- Friendly Safety note card for fallback or adjusted plans.
- Friendly goal rejection copy for unsafe goals.
- Conservative training confirmation after pain/discomfort check-ins.
- `userSafeMessage` so backend-owned safety explanations can be shown without exposing debug internals.

Mobile must not render raw `debug`, `fallbackReason`, provider errors, Safety Agent reason codes, or raw JSON.

## Remaining Limitations

- Progressive prompt UI is intentionally simple.
- Evening reflection UI is not yet exposed on mobile.
- Check-ins influence planning context but do not yet power charts or weekly reports.
- Converted safe goals do not yet show a dedicated mobile explanation after save.
- No real payments, WHOOP, AI Coach chat, embeddings, admin/web, ExerciseLibrary, or exercise media.

## Sprint 6 Preview

Recommended Sprint 6 focus:

- Training preferences.
- Exercise recommendation shape inside `DailyPlanJson`.
- Protocol/template layer for nutrition, training, and recovery.

This improves the core coaching value before real payments and makes Plus/Pro personalization more compelling.
