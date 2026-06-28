# Product Roadmap

## Sprint 8B Batch 1

Mobile information architecture now separates Today, Food, Training, and Profile. Food and Training preferences can be updated after onboarding through reusable domain forms, while Profile is divided into Personal, Health, Connections, and Settings. Preference saves affect future plans without regenerating the current plan.

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

### Sprint 5: Progressive Onboarding, Check-Ins, And Safety UX

Reduced onboarding friction and strengthened the plan-to-fact loop:

- Stage 1 onboarding for the first safe plan.
- Stage 2 progressive profile prompts after the user sees value.
- Allergy confirmation instead of assuming missing allergy data is safe.
- No-training-planned option for users without a current schedule.
- Today progressive prompt card with answer/skip behavior.
- Meal and training check-ins from Plan Details.
- Pain/discomfort safety signal.
- User-facing safety disclaimer in onboarding and Settings.
- Friendly fallback Safety note on Today and Plan Details.
- `DailyPlanJson.safety.userSafeMessage` for user-safe safety explanations.

### Sprint 6: Training Preferences, Protocols, And Exercise Recommendations

Improved core plan quality before adding external health integrations:

- `TrainingPreference` backend/API.
- Progressive prompts saving target muscles, equipment, training level, and limitations.
- Deterministic `ProtocolSelectorService`.
- Nutrition, training, and recovery protocols.
- Selected protocol IDs passed into `AiProvider` context.
- Optional `DailyPlanJson.training.exercises`.
- Exercise safety checks in `SafetyService`.
- Safety Agent exercise review.
- Plan Details rendering for suggested exercises.

### Sprint 7: Health Integration Foundation

Added consent-based health summary foundations:

- `HealthConnection` and `HealthDailySummary` models.
- Health status, connect, disconnect, delete synced data, and daily summary APIs.
- Mobile Health data screen and Settings/Profile card.
- Android Health Connect native sync spike with foreground `Sync now`.
- Expo Go safe fallback for native health sync.
- iOS HealthKit safe unavailable stub.
- Conservative health planning context from stored daily summaries.
- Protocol selection support for low sleep, high activity yesterday, recent workout, and low step trend.
- Safe health context passed to `AiProvider`.
- `debug.healthSignals` booleans only.
- Weight and heart-rate fields excluded from planning context.

## Current Product State

OptiMe can now:

- Onboard users end-to-end.
- Generate real OpenAI daily plans through the backend only.
- Validate AI output with deterministic safety and AI Safety Agent review.
- Preserve normalized plan shape for mobile.
- Adapt plan depth by backend-resolved tier.
- Track and enforce usage limits for expensive generation/refresh actions.
- Show plan and usage placeholder UI on mobile.
- Let users reach the first plan with a shorter safety-first onboarding path.
- Collect progressive profile details and check-ins after activation.
- Collect optional training preferences after activation.
- Select deterministic nutrition, training, and recovery protocols.
- Generate structured AI Nutrition Agent food-plan snapshots inside deterministic nutrition targets.
- Generate optional text-based exercise recommendations.
- Connect optional health providers and store daily health summaries.
- Use summarized health signals conservatively in daily planning.

Still not implemented:

- Real App Store or Google Play payments.
- Production Apple Health / Health Connect rollout.
- iOS native HealthKit implementation.
- Health background sync.
- Health charts or dashboard.
- WHOOP integration.
- AI Coach chat.
- Embeddings-based personalization.
- Admin or web app.
- Exercise library.
- Real predictive coaching engine.

## New Product Requirements

### Progressive Onboarding

Progressive onboarding is now the active onboarding direction.

Implemented direction:

- Stage 1 collects only the minimum required data for a first safe plan.
- Stage 2 progressively collects deeper preferences over the first days.

Stage 1 minimum:

- Name.
- Gender.
- Date of birth or age.
- Height.
- Weight.
- Goal.
- Critical allergy information or explicit no-known-allergies confirmation.
- Basic training schedule or explicit no-training-planned intent.
- Pregnancy/postpartum context when relevant, optional and non-blocking.

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

Daily plan generation is not enough. Sprint 5 added the first plan-to-fact check-ins.

Current micro-check-ins:

- Meal completed, partially completed, skipped, or swapped.
- Training completed, partially completed, skipped, or rested instead.
- Pain/discomfort safety signal.

Future micro-check-ins:

- Evening reflection UI.
- Energy, tiredness, and soreness trend UI.
- Habit loop prompts.

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

Sprint 5 added a lightweight disclaimer in onboarding and Settings:

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

1. Sprint 8: ExerciseLibrary plus professional interactive body map and exercise media foundation.
2. Sprint 9: Real subscriptions/payments and paywall polish.
3. Sprint 10: Predictive adaptive coaching foundation.
4. Sprint 11: WHOOP integration on top of the health-data foundation.
5. Later: AI Coach chat, embeddings, admin/web, meal swaps, and advanced analytics.

This order strengthens the core loop and health-data foundation before monetization and narrower wearable integrations.

Sprint 8 ExerciseLibrary/body map note:

- Production body maps require professional/licensed SVG assets or designer-created assets.
- Each muscle region should be a separate SVG path with stable IDs.
- Dev-generated SVG stubs should not be used in production UI.
- Exercise media should use licensed, owned, or curated assets only.
- AI should select and customize from deterministic exercise data rather than inventing all exercises freely.
## Food Tracking MVP

Completed: lightweight food completion tracking for structured meal plans. Users can mark meals as planned, eaten, partially eaten, or skipped from Food and Meal Details, while Today shows a compact progress summary.

Deferred: custom food logging, portion editing, photo logging, and AI personalization from food completion history.
