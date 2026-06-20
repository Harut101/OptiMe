# Daily Plan language compatibility

Daily Plan structured enum values remain language-neutral. Existing plan text remains exactly as generated and is not translated or regenerated when the user changes application language or measurement system.

Sprint 9A localizes the application shell only. A future Daily Plan localization batch may pass the saved supported locale into generation, but it must preserve schema validation, deterministic safety, Safety Agent review, and historical-plan immutability. Changing settings alone must never call the generation endpoint.
## Localization boundary

Today and Plan Details localize headings, states, usage messages, feedback/check-in controls, and exercise metadata labels. Plan summaries, meal and food names, recommendations, reminders, exercise names, cues, and safety notes remain stored AI content and are rendered without translation or mutation.

Future localized generation should pass locale through the existing backend AI boundary. ExerciseLibrary now provides explicit localized catalog content, but current free-text plan exercises remain unchanged and are not silently remapped.

## Future Food and Training views

Food and Training will be two views of one Daily Plan record, never separately generated plans. Food will own meals, options, portions, preparation, substitutions, and nutrition information. Training will show future library-backed planned exercises and their plan-specific sets, reps/duration, rest, notes, and order. Recovery and reminders remain shared plan content rather than duplicated tab content.

Before ExerciseLibrary integration, the project must choose a localized snapshot or content-version strategy for historical accuracy. This foundation batch does not alter `DailyPlanJson`, regenerate plans, or mutate history.
