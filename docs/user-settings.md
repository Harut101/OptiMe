# User settings

`UserSettings` owns application preferences independently from profile, nutrition, and training data.

Persisted fields:

- `preferredLocale`: `en-US`, `ru-RU`, `fr-FR`, or `zh-CN`
- `measurementSystem`: `METRIC` or `IMPERIAL`

Authenticated clients use `GET /v1/settings` and `PUT /v1/settings`. Updates are partial: changing language preserves the measurement system, and changing units preserves language. Unsupported values are rejected by DTO validation. A user without a row receives safe defaults and `initialized: false`; mobile then persists the supported device-locale result once. Saved preferences always win afterward.

The legacy `User.locale` field is synchronized when language changes for compatibility with existing account context. `UserSettings` is the authoritative application preference source. Settings changes do not regenerate, translate, or mutate current or historical Daily Plans.
## Localized mobile behavior

Changing `preferredLocale` updates the application shell immediately and does not reset form state or regenerate a plan. Changing `measurementSystem` changes display/edit units only; canonical backend values remain metric. Both choices persist through `/v1/settings` and are restored after restart.
