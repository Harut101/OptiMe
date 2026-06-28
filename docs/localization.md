# Localization

Sprint 9A supports `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`. `en-US` is the fallback. `es-419` and `de-DE` are reserved for later work and are not exposed by the application.

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
