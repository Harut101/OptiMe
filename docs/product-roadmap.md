# Product Roadmap

OptiMe is a mobile-first AI wellness coach. It helps users answer four daily questions:

- How ready am I to train today?
- What should I eat today?
- Should I push, maintain, or recover?
- How can I move toward my goal safely?

Safety is never paywalled. Paid tiers improve personalization depth, choice, adaptiveness, history usage, feedback usage, and future integrations.

## Completed Sprints

### Sprint 1: Thin Vertical Slice

Built the mobile and backend foundation:

- Register/login and JWT auth.
- Onboarding profile, goal, nutrition preferences, and training schedule.
- Mock daily plan generation.
- Today screen and plan details.
- PostgreSQL, Prisma, NestJS, Expo, shared schemas/types.

### Sprint 2: Safety And Plan Foundation

Added the safety and data contract foundation:

- Deterministic `SafetyService`.
- Safe mode and under-18 handling.
- Dangerous goal validation.
- Allergy/excluded food enforcement.
- Training intensity and symptom boundaries.
- Normalized `DailyPlanJson`.
- Safe fallback plans.
- Daily plan history and feedback.
- `AiProvider` interface with mock provider.

### Sprint 3: OpenAI Daily Planning

Added real AI generation behind backend-only provider boundaries:

- OpenAI DailyPlan provider.
- Structured Outputs.
- Metadata and food-name normalization.
- Deterministic safety after AI output.
- OpenAI Safety Agent semantic review.
- Retry-with-safety-feedback.
- `AiOperationLog` for safe operational metadata.

### Sprint 4: Tier, Usage, And Mobile Placeholders

Added monetization foundation without real payments:

- Subscription schema and backend entitlement resolution.
- `FeatureAccessService`.
- `PlanQualityMode`: `BASIC`, `PERSONALIZED`, `ADAPTIVE`.
- Menu options by tier.
- Gender and pregnancy/postpartum/breastfeeding safety context.
- `UsageLedger` and `UsageGuardService`.
- Usage limits for generation and refresh.
- `GET /v1/me/entitlements`.
- `GET /v1/me/usage`.
- Mobile tier/usage placeholders.
- Friendly `USAGE_LIMIT_REACHED` UX.

## Current Product State

OptiMe can now:

- Onboard users end-to-end.
- Generate real OpenAI daily plans through the backend only.
- Validate AI output with deterministic safety and AI Safety Agent review.
- Preserve normalized plan shape for mobile.
- Adapt plan depth by backend-resolved tier.
- Track and enforce usage limits for expensive generation/refresh actions.
- Show plan and usage placeholder UI on mobile.

Still not implemented:

- Real App Store or Google Play payments.
- WHOOP or health-platform integrations.
- AI Coach chat.
- Embeddings-based personalization.
- Admin or web app.
- Exercise library.
- Real predictive coaching engine.

## New Product Requirements

### Progressive Onboarding

Current onboarding is functional, but it can become too long as personalization grows.

Recommended direction:

- Stage 1 collects only the minimum required data for a first safe plan.
- Stage 2 progressively collects deeper preferences over the first days.

Stage 1 minimum:

- Name.
- Gender.
- Date of birth or age.
- Height.
- Weight.
- Goal.
- Main allergies.
- Basic training schedule.

Stage 2 progressive profile:

- Preferred foods.
- Excluded foods.
- Pregnancy/postpartum context.
- Target muscle groups.
- Equipment.
- Training level.
- Limitations or pain areas.
- Deeper food preferences.
- Feedback habits.

### Protocol/Template Layer

AI should not invent plans from zero.

Future deterministic protocol layer:

- `NutritionProtocol`.
- `TrainingProtocol`.
- `RecoveryProtocol`.

Example nutrition protocols:

- Safe weight loss.
- Muscle gain.
- Maintenance.
- Pregnancy/postpartum safe.
- Under-18 safe.
- Recovery day.

Example training protocols:

- Strength.
- Endurance.
- Mobility.
- Recovery.
- Beginner gym.
- Home workout.

AI should customize and optimize these protocols. This should reduce hallucinations, improve consistency, improve testability, and reduce OpenAI cost.

### Plan To Fact Check-Ins

Daily plan generation is not enough. The product needs to learn what actually happened.

Future micro-check-ins:

- Lunch check-in.
- Meal completed or skipped.
- Training completed.
- Tiredness 1-10.
- Energy level.
- Soreness or pain.
- Evening reflection.

Examples:

- "Did you manage to eat lunch as planned?"
- "How hard was the workout from 1 to 10?"
- "Any pain, dizziness, or unusual fatigue?"

This should influence the next day's plan and future weekly summaries.

### Habit Loops And Weekly Summary

Future weekly AI summaries should include:

- What went well.
- Consistency.
- Completed plans/check-ins.
- Energy trend.
- Training consistency.
- Supportive coaching message.
- One focus for next week.

Tone must remain supportive and non-shaming.

### Meal And Ingredient Swap

Future Plus feature:

- One-tap ingredient swap.
- Meal alternative.
- Preserve nutrition goal as much as practical.
- Respect allergies and excluded foods.
- Avoid unsafe substitutions.

Example: if the user does not want chicken, suggest turkey, fish, tofu, eggs, or another safe option based on preferences and goal.

### Predictive Adaptive Coaching

Future Pro feature:

- Detect repeated patterns.
- Suggest schedule adaptations.
- Use future WHOOP, Apple Health, or Google Health Connect signals when available.

Example:

- "We noticed Friday workouts are often missed. Want to move your harder session to Thursday and keep Friday as mobility?"

### User-Facing Safety Disclaimer

Future onboarding/profile/settings UX must clearly state:

- OptiMe is an AI wellness assistant, not a medical service.
- It does not diagnose or treat medical conditions.
- For pregnancy/postpartum, injuries, medical symptoms, or major lifestyle changes, consult a qualified professional.

### Hard Safety Block Flows

Some inputs should block aggressive generation and show safe guidance, not only soften the output.

Examples:

- Extreme weight loss.
- Chest pain or serious symptoms.
- Training through pain or dizziness.
- Under-18 aggressive weight-loss pressure.
- Pregnancy/postpartum aggressive dieting.
- Unsafe eating behavior language.

For minors:

- Do not provide graphic self-harm or eating-disorder content.
- Keep messages supportive.
- Recommend qualified help for serious medical or safety concerns.

## Recommended Order

1. Sprint 5: Progressive onboarding, check-ins, and user-facing safety UX.
2. Sprint 6: Protocol/template layer for nutrition, training, and recovery.
3. Sprint 7: Meal/ingredient swap and better preference refinement.
4. Sprint 8: Real subscriptions/payments and paywall polish.
5. Sprint 9: Predictive adaptive coaching foundation.
6. Sprint 10: WHOOP or health-platform integration.
7. Later: AI Coach chat, embeddings, admin/web, exercise library, and media.

This order strengthens the core loop before monetization and external integrations.
