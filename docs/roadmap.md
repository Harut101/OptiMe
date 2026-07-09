# Product roadmap

The detailed roadmap remains in [product-roadmap.md](./product-roadmap.md).

Manual weight tracking is now implemented with `WeightLog`, neutral progress summaries, Today/Profile mobile UI, and future-plan Nutrition Target integration. Garmin is represented as a future health/weight source only; real Garmin OAuth, provider API sync, token storage, and background sync remain deferred.

Auth and onboarding now share the v2 premium mobile visual language, including a stronger primary action accent, branded auth hero, onboarding progress shell, selectable goal/app-mode cards, and unified feedback sheets. Business logic and APIs are unchanged.

Recovery-aware planning foundation is now in place: wearable snapshots feed deterministic wearable planning context and training-load context. A future Training Load Agent can build on this, but deterministic safety remains the hard-rule authority.

Sprint 8B Batch 1 establishes the mobile information architecture: Today, Food, Training, and Profile; reusable domain forms; standalone preference editing; Profile sections; and the existing health connection manager exposed through Connections.

Sprint 8B Batch 2 completes standalone goal editing, shared goal-form reuse, consistent editor dirty-state behavior, validator-based mobile interaction coverage, and a physical-device QA checklist. The recommended next batch is the localization foundation; translated labels must remain separate from persisted enum identities.

Sprint 9A Batch 1 adds the localization foundation, four shell locales, persisted UserSettings, independent measurement display, and validated `Accept-Language` propagation. Full feature translation and localized AI-generated plans remain later localization batches.

ExerciseLibrary Foundation adds stable localized exercise identity, optional one-to-many media architecture, an idempotent 46-exercise catalog, validators, and authenticated read-only APIs. Deterministic ExerciseSelectionService now connects the catalog to Daily Plan generation through bounded allowlists, strict validation, immutable snapshots, one retry, and a trusted fallback workout.

Daily Plan Food/Training views, library-backed exercise cards, and the Exercise Details 4:5 media viewer are now implemented. Deferred work includes approved exercise-media ingestion and storage/CDN registration, workout tracking/history, full localized plan prose, additional wearable providers including WHOOP, richer account/privacy tools, and production subscription purchase flows.

Exercise-media filename reconciliation now gates ingestion with strict parsing, explicit reviewed aliases, deterministic coverage reports, and conflict-safe optional renames. Ingestion remains blocked until every approved image identity and every catalog exercise has an explicit decision. The next media batch begins only after reconciliation reports zero blockers.

Exercise-media catalog expansion is applied: the seed now contains 77 exercises and 308 translations, while preserving all original slugs. Approved aliases were applied and reconciliation now reports 47 canonical WebPs, 46 media-covered exercise identities, and zero filename blockers. The five 2:3 WebP assets were normalized to exact 4:5 with private byte-identical backups, and ExerciseMedia ingestion now registers 47 media rows plus 188 localized media translations. Optimized `480x600` WebP thumbnails are generated for list/card views, while Exercise Details keeps full-size media. Production CDN upload remains pending provider selection.
## Sprint 9A Batch 2 complete

Core mobile UI localization and typed domain-enum labels now cover English, Russian, French, and Simplified Chinese. Historical/AI plan localization, ExerciseLibrary translations, Spanish, German, and RTL remain deferred.
# Roadmap Notes

Completed foundation: app modes and primary goal switching. Nutrition-only is now a first-class mode, and training can be enabled or disabled without deleting saved training settings. Goal and mode changes affect future plans only.

Next recommended batch: Weekly Training Schedule with day-specific muscles, location, equipment including `BARBELL`, duration, rest days, timezone resolution, and Daily Plan integration.

Completed foundation: deterministic Nutrition Engine with backend-owned calorie/macro targets, training-aware day types, DailyPlan target snapshots, mobile-localized reason-code explanations, and structured AI Nutrition Agent meal-plan snapshots.

Food preferences refinement adds disliked-food persistence, standalone `/v1/food-preferences`, ingredient exclusion from Meal Details, meal-level regeneration, and full-menu regeneration. Regeneration preserves stored Nutrition Engine targets and updates only the selected Daily Plan food snapshot after validation.

Still deferred: ingredient database, food tracking, meal completion, grocery list, recipe image generation, WorkoutSession, workout history, rest timers, production CDN deployment, and AI schedule generation.

Workout Execution MVP adds plan-linked workout sessions, set completion, duration exercise completion, partial-finish confirmation, and Plan Details Training entry points. Still deferred: workout history screens, rest timers, workout notes, RPE, replacing exercises during execution, and analytics.

Workout History + Session Summary MVP adds completed workout summaries, completed-only history, Today/Profile/Training entry points, and read-only completed details. Still deferred: analytics, streaks, achievements, rest timers, RPE, load tracking, and workout notes.
## Food Tracking MVP

Food Tracking / Meal Completion MVP is implemented as a lightweight plan-to-fact loop for structured meal plans. It records planned/eaten/partial/skipped meal statuses without custom calorie logging, photo analysis, or AI personalization from history yet.

## Health Integrations Foundation

Wearable integration foundation adds provider-neutral HealthConnection statuses and `WearableDailySnapshot` for Apple Health, Health Connect, WHOOP, manual, and mock sources. Daily Plan generation can now receive optional wearable context for conservative nutrition/training/recovery planning. Real native permissions, WHOOP OAuth, background sync, provider tokens, and analytics dashboards remain deferred.

Apple Health iOS MVP adds the first real provider path: iOS HealthKit permission request, read-only manual sync, normalized `WearableDailySnapshot` storage, Health Connections UI states, friendly last-sync display, and Apple Health-specific snapshot metrics. The MVP permission scope is intentionally limited to activity and sleep signals; respiratory rate, resting heart rate, and HRV remain future nullable fields until advanced recovery/training-load UX is introduced. Health Connect real sync, WHOOP OAuth, background sync, provider tokens, and analytics dashboards remain deferred.

## UI/UX Polish Sprint

The core mobile flows now share a calmer presentation layer for screen headers, section headers, status pills, context notes, compact health metrics, settings hub rows, toasts, feedback sheets, and plan-impact prompts. Today, Food, Meal Details, Training, Workout Session, Workout History, Health Connections, Plan Details, and Profile were polished without changing backend models, nutrition formulas, exercise selection, Apple Health behavior, or payment scope.

Food and Meal Details now use premium nutrition dashboard widgets, compact meal status controls, app-level toasts/sheets, and Plan Impact prompts for current-plan-affecting changes.

Training and Workout screens now use the same premium card language: compact training status, training-load insight, Weekly Routine tiles, workout progress header, redesigned exercise cards, workout history cards, and unified toast/sheet feedback. This remains presentation-only and does not change workout generation, pain-aware replacement logic, safety rules, nutrition logic, health sync, or billing.

## Visual Design Direction

OptiMe now has typed light/dark visual tokens, semantic health colors, a softer premium card system, and an updated Design System Preview. Runtime theme switching remains deferred; this batch establishes the visual foundation without changing product behavior.

## Color Intensity Tuning

Expo Go QA found the visual direction correct but slightly pale. The palette now uses stronger semantic accents, clearer selected states, bordered status pills, and semantic metric highlights. Product behavior, navigation, backend models, formulas, and exercise logic remain unchanged.

## Today Dashboard Progress

Today now provides a clearer daily dashboard with nutrition progress, training progress, and a compact wearable summary. It reuses existing FoodLog, WorkoutSession, HealthConnection, and WearableDailySnapshot data. It does not add new backend models, new formulas, real Health Connect sync, WHOOP, payments, or new AI behavior.

## Today Dashboard Electric Ring Tuning

The Today dashboard rings now use brighter electric segmented gradients for better physical-device readability in Expo Go. This is a visual tuning batch only; Today layout, progress calculations, wearable behavior, backend models, nutrition formulas, exercise selection, and native health behavior remain unchanged.

## Training Cleanup And Pre-Workout Check

Training now uses clearer mobile IA: Today's workout/rest day, training load note, Weekly Routine, Workout History, and Edit Training Setup. Preferred training days and global pain/limitations are removed from visible Training Setup. Pain or limitations are collected in a skippable pre-workout check when starting the current workout session. The check is stored on `WorkoutSession`, does not mutate DailyPlan, and does not call AI.

## Onboarding Simplification

Onboarding now focuses on the person, goal, app mode, nutrition basics, activity level, and safety-critical allergy/profile data. Detailed training setup, preferred training days, Weekly Routine editing, day-specific equipment/environment/duration, and pain/limitations are removed from onboarding. Training-enabled users receive an optional post-onboarding bridge to set up Weekly Routine or skip to Today; training can always be configured later from the Training tab.

## Generate Plan Training Prompt And Duration Volume

Generate Plan now checks the current Weekly Routine weekday before creating a training-enabled plan. Rest-day users can generate a rest-day plan or open the Today-only editor to create a one-off daily training override. The usual Weekly Routine remains a repeating template and is edited only through the explicit Edit Weekly Routine action.

Workout duration now drives deterministic training volume through `WorkoutVolumePlanner`: target/min/max exercise count, suggested sets, rest interval, and estimated session time are calculated before AI generation. Exercise selection, OpenAI prompting, validation, and deterministic fallback all use those constraints so 60-90 minute normal strength plans no longer default to tiny workouts without a safety or candidate-availability reason.

## One-off Daily Training Overrides

Daily training overrides add a date-specific layer above Weekly Routine. Users can train today only or rest today only without mutating their usual weekly template. New Daily Plan snapshots can record `trainingScheduleSnapshot.source = DAILY_OVERRIDE`, and the resolved override context feeds nutrition targets, protocol selection, `WorkoutVolumePlanner`, ExerciseSelectionService, and AI generation.

Backend move-workout support creates a rest override on the source date and a training override on the target date. A richer calendar UI for moving workouts remains deferred.

## Health Data Readiness Before Daily Plan

Today now checks optional wearable readiness before Daily Plan generation. Fresh same-day snapshots proceed immediately; stale connected Apple Health prompts Sync now or Continue without latest data; no connected iOS provider prompts Connect Apple Health or Not now. Not now is suppressed locally for a short period so users are not nagged.

Health data remains optional for both app modes. Nutrition-only users can still benefit from activity/sleep context, but plan generation always continues without wearable data when unavailable. Health Connect real sync, WHOOP OAuth, provider tokens, background sync, and automatic launch sync remain deferred.

## Screen Logic Audit And Content Simplification

The mobile IA now has clearer ownership boundaries across Today, Food, Meal Details, Training, Weekly Routine, Workout Session, Workout History, Health Data, Plan Details, Profile, and Onboarding.

Completed simplifications:

- Today no longer renders permanent usage/limit status.
- Today no longer duplicates Food tab nutrition target or detailed food-progress blocks.
- Usage-limit messages remain contextual to generation or refresh errors.
- Food and Meal Details no longer show noisy missing-image placeholder copy when media is absent.
- Profile keeps account, plan, settings, and connections entry points without permanent usage or provider warning clutter.
- Docs now define a screen responsibility matrix so future batches can add value without piling duplicate content onto Today.

No backend models, payments, WHOOP, Health Connect sync, AI Coach, embeddings, admin, web, or new product flows were added in this cleanup.

## Training Check-in Cleanup And Pain-Aware Adaptation

Training check-ins are now split by timing and responsibility. The old always-visible generic Training check-in block is removed from the training surface.

Pre-workout checks run before starting a workout session. Pain or limitation inputs are mapped to planned exercise muscle groups, conflicts are detected server-side, and the user can adjust today's workout, rest today, or explicitly continue with caution.

Post-workout check-ins appear only after Finish workout and store supportive feedback on the completed `WorkoutSession`. Future personalization can use this history, but this sprint does not add diagnosis, physical therapy guidance, analytics, payments, WHOOP, or new ExerciseLibrary content.

## Pain-Aware Exercise Replacement Suggestions

Adjust today's workout now proposes safer ExerciseLibrary-backed replacements before applying changes. Replacements avoid mapped pain/conflict muscles, respect equipment and level filters, and update only today's DailyPlan training section after user confirmation.

If no safe replacements exist, the app keeps the current plan unchanged and offers Rest today or Continue with caution. Weekly Routine, Training Setup, nutrition, ExerciseLibrary, ExerciseMedia, and completed WorkoutSessions are unchanged.

## Pricing / Entitlement Foundation

OptiMe now has a backend-owned Free / Plus / Pro entitlement foundation without real billing. A central entitlement matrix defines `PlanQualityMode`, feature access, and usage limits for daily plan generation, refresh, meal regeneration, menu regeneration, and AI Training Load Agent calls.

Safety remains available for every tier. Nutrition-only users can still receive paid value through nutrition planning, food preferences, meal/menu regeneration, food tracking, and health-aware nutrition context. Mobile shows contextual limit/upgrade placeholders only when an action is blocked; no real App Store, Google Play, Stripe, receipt validation, pricing amounts, or production purchase flow is implemented yet.
# Visual Design v2 Completion Note

The mobile presentation layer now has an Apple Health-inspired premium direction: stronger light/dark tokens, dashboard widgets, compact AI Coach entry with bottom sheet, provider cards, meal/workout widgets, and settings-list rows.

Future roadmap work should build on this system rather than adding one-off screen styles.
