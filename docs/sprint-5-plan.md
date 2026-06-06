# Sprint 5 Plan

Recommended Sprint 5 focus: Option A, Progressive onboarding + check-ins + safety UX.

## Recommendation

Choose Option A.

Why:

- The core product loop needs lower friction before adding payments or WHOOP.
- Check-ins create the behavioral data needed for real personalization.
- User-facing safety UX should be clear before broader release.
- Protocols and future adaptive coaching will be stronger once the app knows what users actually do.

Do not choose Option C, real payments, yet. We can charge more confidently once onboarding, adherence, and safety UX feel strong.

Do not choose Option D, WHOOP, yet. WHOOP adaptation is valuable, but it needs a stronger base loop and check-in model first.

Option B, training preferences, is useful but should be folded into progressive profiling rather than built as a separate large feature first.

## Sprint 5 Goal

Build the core personalization and adherence foundation:

- Reduce initial onboarding friction.
- Add progressive profile planning and first implementation.
- Add plan-to-fact check-ins foundation.
- Add user-facing safety disclaimer UX.
- Plan the protocol/template layer.

## In Scope

### Progressive Onboarding

Implement or prepare a two-stage onboarding model.

Stage 1 minimum:

- Name.
- Gender.
- Date of birth or age.
- Height.
- Weight.
- Goal.
- Allergy information: at least one allergy or explicit confirmation of no known allergies.
- Basic training intent: a lightweight schedule item or explicit "no training planned yet".
- Pregnancy/postpartum context remains optional and conservative when unknown.

Stage 2 progressive profiling:

- Preferred foods.
- Excluded foods.
- Diet type.
- Meals per day.
- Target muscle groups.
- Equipment.
- Training level.
- Limitations or pain areas.
- Deeper food preferences.
- Cooking time, meal prep, and meal timing preferences.
- Feedback habits.

Sprint 5 should start with the smallest implementation that reduces friction while preserving safe first-plan generation.

### Plan To Fact Check-Ins

Add foundation for micro-check-ins:

- Meal completed or skipped.
- Training completed.
- Tiredness 1-10.
- Energy level.
- Soreness/pain.
- Evening reflection.

Recommended MVP:

- Prisma model for check-ins.
- Backend endpoints.
- Very small mobile UI on Today or Plan Details.
- Use check-ins in future personalization context, but avoid complex analytics in Sprint 5.

Batch 5 adds the first implementation:

- `DailyPlanCheckIn` with flexible JSON payload and strict backend validation.
- Meal, training, and evening reflection check-in types.
- Owned daily-plan check-in endpoints.
- Minimal recent check-in summary for future planning.
- Small Plan Details check-in UI for meals and training.

### User-Facing Safety Disclaimer

Add clear disclaimer copy in onboarding/profile/settings:

- OptiMe is an AI wellness assistant, not a medical service.
- It does not diagnose or treat medical conditions.
- For pregnancy/postpartum, injuries, medical symptoms, or major lifestyle changes, consult a qualified professional.

This should be calm and concise, not scary.

### Hard Safety Block UX Planning

Design and optionally implement first safe block flows for:

- Extreme weight-loss requests.
- Training through pain/dizziness.
- Chest pain or serious symptoms.
- Under-18 aggressive weight-loss pressure.
- Pregnancy/postpartum aggressive dieting.
- Unsafe eating behavior language.

The first implementation can reuse existing backend safety checks and improve user-facing messages.

### Protocol/Template Layer Design

Design deterministic protocol layer:

- `NutritionProtocol`.
- `TrainingProtocol`.
- `RecoveryProtocol`.

Sprint 5 should create the design and maybe add skeleton interfaces. Full protocol implementation can be Sprint 6.

## Out Of Scope

- Real payments.
- App Store or Google Play purchase flow.
- Receipt validation.
- WHOOP.
- AI Coach chat.
- Embeddings.
- Admin/web.
- ExerciseLibrary implementation.
- Exercise images/videos.
- Full meal swap implementation.
- Full predictive coaching implementation.

## Suggested Implementation Batches

### Batch 1: Progressive Onboarding Design And Implementation Plan

- Define Stage 1 vs Stage 2 completion.
- Decide required fields for first plan generation.
- Update onboarding status model/endpoint if needed.
- Preserve backward compatibility.

### Batch 2: Backend Stage 1 Onboarding Status

- Add Stage 1 readiness fields to `GET /v1/onboarding/status`.
- Preserve old onboarding fields for current mobile compatibility.
- Add backend-safe allergy confirmation and no-training-planned intent flags.
- Allow first-plan generation once Stage 1 is complete, without requiring Stage 2 personalization.

### Batch 3: Mobile Progressive Onboarding UX

- Shorten first-run onboarding.
- Move deeper preferences to optional progressive profile prompts.
- Keep first safe daily plan generation possible.

### Batch 4: Check-In Foundation

- Add `DailyCheckIn` or similar model.
- Add endpoints for meal/training/energy/pain/reflection check-ins.
- Add ownership tests.
- Do not add embeddings or advanced analytics.

### Batch 5: Mobile Check-In UX

- Add small Today/Plan Details check-in prompts.
- Keep the UI lightweight and supportive.
- Avoid shame-based streak language.

### Batch 6: Safety Disclaimer And Hard Block UX

- Add user-facing disclaimer copy.
- Improve safety block messages for serious symptoms and aggressive goals.
- Ensure minors receive supportive, non-graphic, help-seeking guidance.

### Batch 7: Protocol Layer Design

- Document protocol types and interfaces.
- Decide how protocols feed OpenAI provider context.
- Prepare Sprint 6 implementation plan.

## Acceptance Criteria

- First-plan onboarding is shorter than current flow.
- Deeper personalization fields are still available progressively.
- Check-ins can be saved and owned by the user.
- Safety disclaimer is visible in appropriate places.
- Safety is still not paywalled.
- Existing daily plan generation and usage-limit behavior remains intact.
- Mobile typecheck, API build, and e2e tests pass.

## Why Before Payments Or WHOOP

Real payments require confidence that the core loop has value. Progressive onboarding and check-ins improve activation and retention, which are prerequisites for monetization.

WHOOP can make Pro much stronger, but only after the app already has a reliable daily plan -> user behavior -> next plan loop. Otherwise WHOOP data would sit on top of an incomplete adherence model.
