# Localization

Sprint 9A supports `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`. `en-US` is the fallback. `es-419` and `de-DE` are reserved for later work and are not exposed by the application.

## Recovery-Aware Plan Notes

Mobile plan context notes use localization keys under `contextNotes`. New keys must be present through the base English resource and translated overrides for `ru-RU`, `fr-FR`, and `zh-CN`.

The mobile runtime uses `i18next`, `react-i18next`, and `expo-localization`. Translation resources live under `apps/mobile/src/i18n/locales`. Persisted values are stable locale codes and domain enum values; translated labels are presentation only. Native language names remain fixed in the selector: English (United States), Русский, Français, and 简体中文.

For users without saved settings, the primary device locale is resolved as follows: `en-*` to `en-US`, `ru-*` to `ru-RU`, `fr-*` to `fr-FR`, and `zh-CN`, `zh-SG`, or `zh-Hans-*` to `zh-CN`. Unsupported locales, including Traditional Chinese variants, fall back to `en-US`. Once saved, the user's preference overrides device detection.

The app changes shell language at runtime after a successful settings save. Missing keys fall back to English and emit a development warning. API requests include a validated `Accept-Language` header while preserving authentication headers.

This batch localizes navigation, common actions, unsaved-change controls, and Settings. Full feature copy and AI-generated content are deferred. Future domain labels should be resolved from stable values through centralized key maps, never persisted as translated text. All current locales are left-to-right; RTL requires a separate layout and QA batch.
## Sprint 9A Batch 2

The core mobile shell is localized for `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`. English is the canonical typed resource; locale resources deep-merge over it for safe fallback. Feature namespaces cover authentication, onboarding, Today, plan details, Food, Training, Profile, Goals, Health, Body Map, settings, progressive prompts, errors, and stable enum labels.

Persisted domain values are never translated. `src/i18n/enum-labels.ts` maps stable values to translation keys, including legacy muscle groups. Interpolation variables must match English and are checked by `localization:validate`.

Existing and historical AI plan content remains exactly as stored. A localized Russian, French, or Chinese shell may therefore display English generated content until plan-generation localization is designed separately. No render-time or external translation is used.

ExerciseLibrary content is stored in explicit `ExerciseTranslation` and `ExerciseMediaTranslation` rows for all four supported locales. Read APIs use validated `Accept-Language`, project through the requested locale, and fall back deterministically to `en-US`. Slugs, IDs, enums, URLs, and business logic remain language-neutral; translations are never generated at request time.

Exercise thumbnails and full media share the same localized `ExerciseMediaTranslation` alt text. Switching locale changes text projection only; it never changes media identity, thumbnail paths, or stored snapshots.

Daily plan exercise selection resolves the saved preferred locale and falls back to English per exercise. New plan snapshots preserve localized name, instructions, cues, and safety notes. Changing app language later does not mutate an existing snapshot. General AI plan prose localization remains separate work.

Known backend codes are presented with localized application messages; unknown failures use localized generic fallbacks while technical errors remain available to development logging.

Daily Plan Food/Training tabs, Exercise Details headings and states, media position announcements, and exercise prescription labels are available in all four supported locales. Exercise equipment, category, movement pattern, and muscle labels use the centralized enum map. Stored snapshot prose and plan-specific AI text are displayed as persisted and are never translated at render time.

Deterministic nutrition target explanations are an exception to free-text plan prose: the backend returns `titleCode`, `reasonCodes`, and safe params, and mobile maps them to localized copy. Missing profile fields are mapped to localized labels before display. New nutrition target previews and snapshots should not use backend-authored English bullets as the primary UI contract.
# Localization Notes

The mobile app currently supports `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`.

The base locale resource now includes app mode, primary goal, training disabled, and design-system preview strings. Locale override files inherit base keys through `createLocaleResource`, so all four locales have runtime coverage even when an override has not yet been translated.

Avoid concatenating English fragments manually. Add full user-facing strings to locale resources and use enum-label helpers for enum display values.

## Food Refinement Strings

Food preference, ingredient exclusion, meal regeneration, and menu regeneration copy is localized in `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`.

Use complete translation keys for confirmation dialogs and loading/error states. Do not assemble confirmation text from English fragments, especially for nutrition-target preservation copy.

## Workout Execution Strings

Workout execution uses the `workout` namespace in all supported mobile locales. Set labels, progress labels, partial-completion confirmation, read-only completed state, friendly save errors, and safety reminders are localized. Exercise names, cues, and safety notes remain saved plan or ExerciseLibrary content and are not translated at render time.

Workout history and summary strings also live in `workout`. History list labels, empty state, completed/partial labels, View summary, read-only state, and accessibility labels are localized across `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`.
## Food Tracking Localization

Food tracking strings live under `foodTracking` in all supported mobile locales:

- `en-US`
- `fr-FR`
- `ru-RU`
- `zh-CN`

Keep completion language neutral and supportive. Avoid shame-based wording around skipped or partial meals.

## Health Connections Localization

Health Connections foundation strings live under `health` in all supported mobile locales. This includes connection status, provider descriptions, wearable snapshot states, mock-data development copy, and accessibility labels.

Use `getHealthProviderLabel` for stable provider enums: `APPLE_HEALTH`, `HEALTH_CONNECT`, `WHOOP`, `MANUAL`, and `MOCK`. Do not concatenate provider names with English status fragments.

Apple Health iOS MVP strings also live under `health`, including Connect Apple Health, Sync Apple Health, permission denied, native unavailable, no-data, and iOS Settings guidance. Health Connect must remain labeled exactly `Health Connect`.

## UI polish strings

The UI polish pass reused existing localized strings for headers, status labels, empty states, errors, and health connection actions. New visual primitives receive already-localized text from their calling screens. Avoid adding English-only props or manually concatenated English fragments when extending these primitives.

The visual design direction pass added only Design System Preview labels to the base English resource. Locale resources deep-merge over English, so all supported locales have effective runtime coverage. Production screens continue to pass localized strings into primitives instead of hardcoded English.
