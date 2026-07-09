# Profile architecture

Profile is organized as a stacked settings hub:

- **Account/Profile** edits identity and mutable profile attributes through `/v1/profile`.
- **Goal and nutrition** links to the standalone goal editor and Food ownership surfaces.
- **Weight** updates the current profile weight and can show a plan-impact prompt for regenerating today.
- **Training** links to Training, Weekly Routine, and Workout History instead of duplicating workout content.
- **Connections** presents the platform-supported Apple Health or Health Connect status and links to the existing connection manager.
- **Settings** presents account, entitlement, persisted language and measurement-system controls, support/privacy, and logout behavior.

Domain ownership stays explicit: personal data belongs to Profile, food choices to NutritionPreference, training setup to TrainingPreference, provider state to HealthConnection, and language/unit preferences to UserSettings.

The Connections card is provider-neutral at the section boundary. Additional verified providers can be added later without turning each provider into a bottom tab or displaying unsupported providers as active.

Personal keeps profile attributes and goal resources separate. Weight, height, activity level, gender, and pregnancy/postpartum context use `/v1/profile`; the Goals card opens a nested editor that uses `/v1/goals`. Both save paths affect future recommendations only.

Leaving a dirty profile or settings editor uses the shared unsaved-change guard.

Settings follows the same draft contract. Language and measurement-system changes are saved together, update the shell immediately after success, and never trigger Daily Plan generation. Profile measurements remain canonical kg/cm and are formatted for display from the saved measurement system.
## Localized sections

The hub uses localized presentation labels over existing resource boundaries. Read-only summaries use locale-aware dates and units; activity, goals, providers, tiers, and plan quality use the shared typed enum-label layer.
