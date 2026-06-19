# Profile architecture

Profile is organized into four internal sections:

- **Personal** edits identity and mutable profile attributes through `/v1/profile`. Goal data is read from its own `/v1/goals` resource rather than merged into the profile payload.
- **Health** presents person-level safety context and the wellness disclaimer. It does not duplicate provider controls.
- **Connections** presents the platform-supported Apple Health or Health Connect status and links to the existing connection manager for sync, disconnect, and deletion behavior.
- **Settings** presents connected account, entitlement, usage, and logout behavior. Unsupported language, measurement, notification, and account tools are clearly described as future work without fake persistence.

Domain ownership stays explicit: personal data belongs to Profile, food choices to NutritionPreference, training setup to TrainingPreference, provider state to HealthConnection, and application behavior to future UserSettings.

The Connections card is provider-neutral at the section boundary. Additional verified providers can be added later without turning each provider into a bottom tab or displaying unsupported providers as active.

Personal keeps profile attributes and goal resources separate. Weight, height, activity level, gender, and pregnancy/postpartum context use `/v1/profile`; the Goals card opens a nested editor that uses `/v1/goals`. Both save paths affect future recommendations only.

Switching Profile sections keeps section components mounted so a Personal draft is not silently destroyed. Leaving a dirty editor uses the shared unsaved-change guard.
