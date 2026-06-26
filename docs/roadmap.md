# Product roadmap

The detailed roadmap remains in [product-roadmap.md](./product-roadmap.md).

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

Completed foundation: deterministic Nutrition Engine with backend-owned calorie/macro targets, training-aware day types, DailyPlan target snapshots, and mobile-localized reason-code explanations.

Still deferred: specialized Nutrition Agent, meal generation, recipe generation, ingredient database, food tracking, WorkoutSession, workout history, rest timers, production CDN deployment, and AI schedule generation.
