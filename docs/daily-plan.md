# Daily Plan language compatibility

Daily Plan structured enum values remain language-neutral. Existing plan text remains exactly as generated and is not translated or regenerated when the user changes application language or measurement system.

Sprint 9A localizes the application shell only. A future Daily Plan localization batch may pass the saved supported locale into generation, but it must preserve schema validation, deterministic safety, Safety Agent review, and historical-plan immutability. Changing settings alone must never call the generation endpoint.
## Localization boundary

Today and Plan Details localize headings, states, usage messages, feedback/check-in controls, and exercise metadata labels. Plan summaries, meal and food names, recommendations, reminders, exercise names, cues, and safety notes remain stored AI content and are rendered without translation or mutation.

Future localized generation should pass locale through the existing backend AI boundary. ExerciseLibrary now provides explicit localized catalog content, but current free-text plan exercises remain unchanged and are not silently remapped.

## Food and Training views

Food and Training are two local views of one Daily Plan record, never separately generated plans. Food owns the existing meal and hydration presentation. Training shows library-backed planned exercises and their plan-specific sets, reps/duration, rest, notes, and order. Recovery, reminders, and feedback remain shared plan content rather than duplicated tab content.

## Library-backed exercises

Newly generated plans may include optional `exerciseId`, `slug`, plan notes, and `exerciseSnapshot` while retaining existing name, sets/reps/rest/duration, intensity cue, and safety note fields. Old free-text items continue to parse and render. Existing rows are not migrated or regenerated.

Snapshots preserve localized trusted catalog content and generation-time `exerciseUpdatedAt`; later library edits or language changes do not mutate history. Media is not snapshotted. Exercise Details combines immutable snapshot text with current active media without mutating the plan.
# Daily Plan Notes

Daily Plan generation now respects the persisted app mode.

When the current app mode is `NUTRITION_ONLY`, the backend keeps nutrition, hydration, recovery, and reminders available while skipping exercise selection. The returned `DailyPlanJson.training` section remains present for schema compatibility, but it is normalized to a REST state with an empty `training.exercises` array.

When the current app mode is `NUTRITION_AND_TRAINING`, existing protocol selection, weekly schedule context, exercise selection, deterministic safety, and AI Safety Agent review remain active.

Changing app mode or primary goal affects future plans only. Existing saved Daily Plans are not regenerated automatically.

Daily Plans generated after the deterministic nutrition target batch include `plan.nutritionTargetSnapshot`. The snapshot stores backend-owned calorie and macro targets plus localized-ready explanation reason codes. Mobile renders those codes in the selected app language.

Older Daily Plans without the snapshot, or with legacy `explanation.title` and `explanation.bullets`, remain readable and are not migrated or rewritten.
