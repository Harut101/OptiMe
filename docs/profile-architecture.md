# Profile architecture

Profile is organized into four internal sections:

- **Personal** edits identity and mutable profile attributes through `/v1/profile`. Goal data is read from its own `/v1/goals` resource rather than merged into the profile payload.
- **Health** presents person-level safety context and the wellness disclaimer. It does not duplicate provider controls.
- **Connections** presents the platform-supported Apple Health or Health Connect status and links to the existing connection manager for sync, disconnect, and deletion behavior.
- **Settings** presents account, entitlement, usage, persisted language and measurement-system controls, and logout behavior. Notification and richer account tools remain clearly deferred.

Domain ownership stays explicit: personal data belongs to Profile, food choices to NutritionPreference, training setup to TrainingPreference, provider state to HealthConnection, and language/unit preferences to UserSettings.

The Connections card is provider-neutral at the section boundary. Additional verified providers can be added later without turning each provider into a bottom tab or displaying unsupported providers as active.

Personal keeps profile attributes and goal resources separate. Weight, height, activity level, gender, and pregnancy/postpartum context use `/v1/profile`; the Goals card opens a nested editor that uses `/v1/goals`. Both save paths affect future recommendations only.

Switching Profile sections keeps section components mounted so a Personal draft is not silently destroyed. Leaving a dirty editor uses the shared unsaved-change guard.

Settings follows the same draft contract. Language and measurement-system changes are saved together, update the shell immediately after success, and never trigger Daily Plan generation. Profile measurements remain canonical kg/cm and are formatted for display from the saved measurement system.
## Localized sections

Personal, Health, Connections, and Settings are localized presentation sections over their existing resource boundaries. Read-only summaries use locale-aware dates and units; activity, goals, providers, tiers, and plan quality use the shared typed enum-label layer.
