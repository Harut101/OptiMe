# Product roadmap

The detailed roadmap remains in [product-roadmap.md](./product-roadmap.md).

Sprint 8B Batch 1 establishes the mobile information architecture: Today, Food, Training, and Profile; reusable domain forms; standalone preference editing; Profile sections; and the existing health connection manager exposed through Connections.

Sprint 8B Batch 2 completes standalone goal editing, shared goal-form reuse, consistent editor dirty-state behavior, validator-based mobile interaction coverage, and a physical-device QA checklist. The recommended next batch is the localization foundation; translated labels must remain separate from persisted enum identities.

Sprint 9A Batch 1 adds the localization foundation, four shell locales, persisted UserSettings, independent measurement display, and validated `Accept-Language` propagation. Full feature translation and localized AI-generated plans remain later localization batches.

ExerciseLibrary Foundation adds stable localized exercise identity, optional one-to-many media architecture, an idempotent 46-exercise catalog, validators, and authenticated read-only APIs. It deliberately leaves current DailyPlanJson and Body Map behavior unchanged.

Deferred work includes ExerciseSelectionService, safe Daily Plan candidate integration, Exercise Details/media UI, full localized plan generation, additional wearable providers including WHOOP, richer account/privacy tools, and production subscription purchase flows.
## Sprint 9A Batch 2 complete

Core mobile UI localization and typed domain-enum labels now cover English, Russian, French, and Simplified Chinese. Historical/AI plan localization, ExerciseLibrary translations, Spanish, German, and RTL remain deferred.
