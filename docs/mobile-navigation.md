# Mobile navigation

OptiMe's primary mobile navigation has four domain-owned tabs:

- **Today** owns the current daily plan, daily progress, and check-ins.
- **Food** owns nutrition preferences and foods to prefer or avoid.
- **Training** owns training preferences, target muscles, equipment, and schedule.
- **Profile** owns personal data, health context, connections, and application settings.

Health and Connections are Profile sections, not primary tabs. Workout create/edit screens are stack routes above Training, so returning preserves the Training tab state. Expo Router remains the navigation system and Ionicons remains the icon system.

Standalone editors keep local draft state. Switching tabs does not save or reset a draft; removing an editor with unsaved changes prompts before discarding it.

New copy uses stable enum values for persistence. User-facing labels remain separate so a later localization layer can translate labels without changing API identities.

Profile → Personal opens the nested `/goal-editor` route for post-onboarding goal changes. Food, Training, Personal, and Goals compare each draft with its last persisted baseline. Save is disabled without a real change or while saving; Cancel restores that baseline; guarded back navigation prompts only while dirty.

See `sprint-8b-mobile-qa.md` for the manual iPhone checklist covering safe areas, keyboards, scrolling, and tab fit.
