# Measurement system

Language and measurement system are independent settings. The API persists only stable values: `METRIC` and `IMPERIAL`.

OptiMe continues to store canonical profile measurements as kilograms and centimeters. Selecting Imperial changes display formatting at the mobile boundary only: kilograms are formatted as pounds and centimeters as feet/inches. It does not rewrite profile records, historical plans, health summaries, or AI operation data.

Locale-aware formatters in `apps/mobile/src/i18n/formatters.ts` handle dates, times, numbers, percentages, weight, and height through `Intl`. Callers must provide both locale and measurement system for measurements. Input conversion for future Imperial editing is deferred and must convert back to canonical kg/cm before API submission.
## Editable profile fields

Profile height and weight are displayed in the selected system. Imperial edits accept inches and pounds and convert back to centimeters and kilograms only when the form value changes and is saved. Locale changes affect number/unit presentation but do not select a different measurement system. Body Map dimensions are independent of this setting.
