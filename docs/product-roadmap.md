# Product Roadmap

## Current Release Direction

The mobile UI/UX consolidation and physical-device visual QA are accepted. The shared light/dark theme, auth and onboarding presentation, floating tab navigation, bottom sheets, feedback patterns, responsive localized layouts, and core Today/Food/Training/Profile surfaces are now the visual baseline for future work.

The next active phase is release readiness:

1. Keep the accepted UI stable and fix only verified regressions.
2. Keep the completed foreground-only Adaptive Plan Checkpoint stable.
3. Release Readiness Batches 1-2 repository work is implemented: email verification,
   password recovery, auth rate limits, strict production configuration, password-confirmed
   account deletion, localized Resend templates, explicit legal consent, in-app legal links,
   and store-privacy documentation. External Resend sender/domain setup, legal review,
   public document hosting, and real-inbox deliverability QA remain.
4. Freeze new product features.
5. Complete Android Health Connect development-build/device QA and Google Play Health declarations.
6. Run release-focused privacy, permission, native-build, and end-to-end QA.

Garmin integration is intentionally deferred until after the first release. Do not add Garmin OAuth, API sync, provider tokens, or background sync to the release-critical path.

Apple Health development-build QA on macOS/Xcode and a physical iPhone is accepted, including native build/pods, HealthKit permissions, read-only sync, and mobile rendering. App Store submission and Apple's external privacy/entitlement review remain release-distribution steps rather than implementation blockers.

Adaptive Plan Checkpoint is the only new product feature approved before the
first-release feature freeze. It must reuse the current DailyPlan, Plan Impact,
health-summary, check-in, deterministic safety, and AI provider boundaries rather
than introduce a parallel planning system.

The approved Free-tier production direction is one Basic Daily Plan per local day
using the cost-efficient OpenAI Luna route, no manual plan refresh, no full-menu
regeneration, and at most two AI meal regenerations per month. Tracking, workout
execution/history, deterministic substitutions, health connections, and safety
remain available. The backend entitlement and usage matrices now enforce these
limits.

The launch-candidate paid pricing is `$19.99/month` or `$199.99/year` for Plus
and `$39.99/month` or `$399.99/year` for Pro. Plus routes its main Personalized
plan through Terra; Pro also uses Terra for its Adaptive launch context behind
the internal `SOL` route. The provider Sol model remains deferred until it
passes the representative reliability and latency gate. These amounts
must not become customer-facing until per-agent token/cost telemetry proves at
least 65% contribution margin after storefront commission and other variable
costs. No paid tier is unlimited. The first-release purchase architecture uses
RevenueCat over App Store and Google Play while preserving backend-authoritative
entitlements. See
[pricing-subscriptions-release-plan.md](./pricing-subscriptions-release-plan.md).

## Sprint 8B Batch 1

Mobile information architecture now separates Today, Food, Training, and Profile. Food and Training preferences can be updated after onboarding through reusable domain forms, while Profile acts as a settings hub for account/profile, goals, current weight, plan tier, health connections, language/units, privacy, and safety context. Preference saves affect future plans without regenerating the current plan.

The first-run experience now uses the same premium v2 mobile presentation as the rest of the app: stronger primary CTAs, branded auth screens, a compact onboarding shell, selectable goal/app-mode cards, and unified feedback. This improves activation without adding new required onboarding fields.

OptiMe is a mobile-first AI wellness coach. It helps users answer four daily questions:

- How ready am I to train today?
- What should I eat today?
- Should I push, maintain, or recover?
- How can I move toward my goal safely?

Safety is never paywalled. Paid tiers improve personalization depth, choice, adaptiveness, history usage, feedback usage, and future integrations.

## Completed Sprints

### Sprint 1: Thin Vertical Slice

Built the mobile and backend foundation:

- Register/login, email verification, password recovery, and versioned JWT auth.
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

### Plan Impact Foundation

Added a read-only impact evaluation layer so OptiMe can explain when profile, goal, food, training, or health changes may affect today's already-generated plan. Mobile now offers a contextual choice to update today's plan or apply the change to future plans only. Evaluation itself does not consume usage; actual regeneration still goes through existing usage-guarded daily plan refresh.

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
- Track manual weight history, show neutral goal progress, and use the latest manual current weight for future nutrition targets.

Still not implemented:

- Real App Store or Google Play payments.
- Production Apple Health / Health Connect rollout.
- App Store submission and external Apple privacy/entitlement review for the verified read-only Apple Health MVP.
- Health background sync.
- Health charts or dashboard.
- Garmin OAuth/API sync and provider-driven weight import; explicitly deferred until after the first release.
- WHOOP production developer-app approval and physical-account release QA.
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
- Optional evening reflection for energy, tiredness, soreness, and a private note.
- A seven-entry reflection trend inside the reflection sheet, without free-text notes.

Future micro-check-ins:

- Habit loop prompts.

This should influence the next day's plan and future weekly summaries.

### Habit Loops And Weekly Summary

Current weekly summary MVP:

- A Profile entry opens a separate Weekly Summary screen.
- It shows current-week plan count, completed workout count, and aggregate evening reflection values.
- It does not expose free-text notes, apply a score, or use AI.

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

### Adaptive Plan Checkpoint

Pre-release feature implemented through Batch 4: shared checkpoint facts
and result contracts, deterministic material-change thresholds, a reusable
`PlanCheckpointMaterialChangeDetectorService`, backend-owned plan baselines,
ownership-safe API evaluation, AI adjustment proposals, complete schema and
safety validation, separate proposal persistence, explicit apply/keep APIs,
optimistic stale protection, localized mobile review, and focused unit/E2E
coverage. The feature remains foreground-only and never changes a plan without
explicit user approval.

Purpose:

- Close the loop between the morning plan and meaningful changes later in the day.
- Recheck whether today's existing plan still fits after a foreground health sync,
  an app-open checkpoint, or a pre-workout check.
- Propose a safe adjustment without silently replacing the user's plan.

Initial inputs:

- The current normalized DailyPlan.
- Fresh optional Apple Health or Health Connect summary data already supported by
  OptiMe: sleep duration, steps, active energy, exercise minutes, and workouts.
- Meal and workout completion facts.
- Energy, tiredness, soreness, pain, and limitation check-ins.
- Existing goal, app mode, nutrition targets, training schedule or daily override,
  and safety context.

Required flow:

1. A deterministic material-change detector decides whether the new facts are
   significant enough to review.
2. If nothing materially changed, keep the current plan and avoid unnecessary AI
   calls or user prompts.
3. If review is useful, AI proposes a complete normalized plan adjustment within
   existing deterministic nutrition, training-volume, catalog, and safety bounds.
4. Schema validation, deterministic SafetyService, and Safety Agent review run
   before showing the proposal.
5. Mobile shows a concise comparison and lets the user choose Review changes,
   Apply update, or Keep current plan.
6. Only an explicitly accepted proposal updates today's plan and records why it
   changed.

Safety and trust requirements:

- Never diagnose burnout, poor recovery, or a medical condition.
- Never claim continuous or emergency monitoring.
- Never silently cancel a workout, add calories, or replace meals.
- Do not infer a negative health state from a missing metric.
- Do not use HRV, resting heart rate, respiratory rate, recovery score, or strain
  until those permissions and validated product rules are introduced explicitly.
- Pain, illness, dizziness, exhaustion, allergies, excluded foods, under-18 rules,
  pregnancy/postpartum context, and dangerous goals remain deterministic hard
  rules.
- Nutrition adjustments must preserve the backend-owned target contract unless a
  separately validated Nutrition Engine recalculation is required.
- Core safety adjustments are available to every tier and are never paywalled.
- Health data remains optional; manual check-ins provide a useful non-wearable path.

Pre-release scope:

- Foreground checks only.
- No background HealthKit or Health Connect delivery.
- No push notifications.
- No continuous heart-rate monitoring.
- No automatic plan mutation.
- No new wearable provider.

Acceptance criteria:

- A meaningful health or check-in change can produce one safe adjustment proposal.
- No meaningful change produces no prompt and no AI request.
- The original plan remains available until the user accepts the proposal.
- Rejected, invalid, unsafe, or unavailable AI output leaves the current plan
  unchanged and shows supportive feedback.
- Nutrition targets, exercise selection, duration budgets, restrictions, and
  safety behavior remain valid after adjustment.
- The flow works without connected health data.
- API, mobile, E2E, localization, and physical iPhone QA pass before feature freeze.

### Future Competitive Features

After the first release:

- Recovery Trend: use several weeks of history to identify supportive recovery
  patterns without diagnosing burnout or overtraining.
- Photo Food Logging: estimate meal contents and nutrition from a photo, require
  user confirmation, and clearly communicate portion uncertainty.
- Smart Shopping: start with an ingredient list and provider deep link, then add
  deterministic catalog matching for real products, prices, availability,
  nutrition, allergies, and exclusions. Full prefilled carts or checkout require
  an approved commercial provider integration. AI may interpret and rank options,
  but it must not invent products, stock, prices, nutrition, or availability.
- Audio Co-Pilot: explore voice set logging and non-medical workout guidance only
  after wearable, latency, privacy, and safety feasibility work.
- Transparent Plan Checks: explain that nutrition, training, catalog, and safety
  checks approved a plan. Do not present fictional cardiologists or fabricated
  expert debates.

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

1. Completed: implement and validate the foreground Adaptive Plan Checkpoint.
2. Completed: formalize bounded Nutrition, Training, Recovery, and Safety agent
   boundaries under a backend orchestrator. Generation context, agent execution,
   safety, finalization, persistence, Today resolution, food mutations, training
   adjustments, and history/feedback now have explicit use-case boundaries.
3. Completed: add tier-aware OpenAI model routing and per-request agent
   token/cost telemetry.
4. Completed: add safely configurable monthly AI cost ceilings, approved Free
   production limits, and an aggregate median/p95 cost report.
5. In progress: the strict combined quality and pricing gate is implemented.
   Populate current deployment model IDs/prices/ceilings, collect representative
   30-day Free/Plus/Pro telemetry, and require `ai-release:gate` to pass before
   billing work. A cheaper Free route is not accepted if READY rate falls or
   fallback/retry rates exceed the shared quality thresholds. The bounded Free
   multilingual safety matrix is complete: 20/20 READY plans across four locales
   and five normal/safety scenarios passed the contract with no retries or
   fallbacks. A bounded five-scenario Free/Plus/Pro economics sample is also
   complete and supports Luna for Free plus Terra for paid launch contexts.
   Pregnancy avoidance false positives and redundant exercise-slug retries found
   by that sample were corrected without weakening safety. The 30-day tier
   telemetry requirement remains. Production AI preflight now validates and
   safely reports effective tier models, provider prices, semantic safety,
   quality thresholds, and launch-candidate monthly ceilings without exposing
   secrets. A versioned rolling monitor now writes aggregate, non-identifying
   quality/economics snapshots for external scheduling while the strict gate
   remains the billing and deployment blocker.
6. Implementation complete: WHOOP is the first specialized pre-release Pro integration: secure
   OAuth, encrypted token lifecycle, foreground recovery/sleep/cycle/workout
   sync, normalized signals, disconnect/delete controls, and conservative
   planning integration. Batch 3 implements backend OAuth, refresh-token
   rotation, foreground provider data sync, normalized snapshots, and mobile
   connection UX. Batch 4 completes calibrated, cycle-matched Recovery
   normalization and conservative deterministic planning. Provider approval and
   physical-account QA remain external release gates.
7. Completed planning: freeze launch-candidate Plus/Pro prices, the cross-store
   product catalog, RevenueCat purchase adapter boundary, backend-authoritative
   entitlement flow, lifecycle rules, and billing release gates.
8. In progress: the shared subscription contract, canonical product catalog,
   disabled billing config, provider adapter boundary, replay-safe billing event
   persistence, authenticated RevenueCat webhook, backend reconciliation, and
   localized mobile sandbox purchase/restore/manage UX are implemented. Billing
   remains disabled by default. Next complete App Store/Google Play/RevenueCat
   sandbox configuration and lifecycle QA after the quality/economics gate
   passes. Paid access is never granted from mobile callbacks alone.
9. Freeze new product features for the first release.
10. In progress: password-confirmed account deletion, production environment validation,
   explicit CORS/proxy configuration, and single-instance auth rate limits are implemented.
   Production startup now also rejects mock AI, missing tier models/prices,
   disabled semantic safety, and absent monthly AI cost enforcement.
   Runtime liveness/readiness probes and graceful Prisma shutdown are implemented
   for safe single-instance deployment and later horizontal scaling.
   Server-owned request correlation and a safe global exception boundary are
   implemented without changing established mobile error response bodies.
   The single-server forward-only migration, verified PostgreSQL backup, code
   rollback, and new-database recovery runbook is implemented; provider backup
   scheduling and a staging restore rehearsal remain external gates.
   Complete external privacy declarations, data-export policy, edge protection, and monitoring
   release readiness.
11. Complete Android Health Connect development-build/device QA and Google Play
   declarations.
12. Run iOS/Android release builds, full automated regression, localization QA, and
    physical-device QA.
13. In progress: the provider-neutral exercise-media CDN artifact now packages
    and validates all WebP and mobile JPEG runtime variants with checksum, MIME,
    and bounded cache metadata. Complete external bucket/domain upload and the
    all-object CDN smoke test before release builds.
14. Release the stable first version.
15. Add Recovery Trend and Photo Food Logging based on real user feedback.
16. Add Smart Shopping MVP with ingredient lists and provider deep links; defer
    catalog/cart integration until a provider partnership is approved.
17. Evaluate Garmin only after release and a separate provider review.
18. Evaluate Audio Co-Pilot, AI Coach chat, embeddings, admin/web, and
    advanced analytics as separate approved product phases.

This order adds one differentiated closed-loop feature before release, then protects
release quality by preventing further scope expansion.

## Food Tracking MVP

Completed: lightweight food completion tracking for structured meal plans. Users can mark meals as planned, eaten, partially eaten, or skipped from Food and Meal Details, while Today shows a compact progress summary.

Deferred: custom food logging, portion editing, photo logging, and AI personalization from food completion history.
