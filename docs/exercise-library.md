# ExerciseLibrary

ExerciseLibrary is the language-neutral catalog of exercises. It provides stable IDs and slugs, classification, localized instructional content, and optional media. It does not choose exercises for a user, inspect health data, call OpenAI, or modify a Daily Plan.

## Persistence

`Exercise` owns stable catalog metadata: category, movement pattern, equipment, target and secondary muscles, supported training levels, conservative contraindication tags, active state, and deterministic sort order. `ExerciseTranslation` owns localized name, description, ordered instructions, coaching cues, and safety notes. Deleting an exercise cascades to its translations and media.

Identity never depends on a translated name. Slugs are globally unique and remain untranslated. Translation rows are unique by exercise and locale. The supported locales are the existing `en-US`, `ru-RU`, `fr-FR`, and `zh-CN` contract; API projection resolves the requested locale and falls back to English.

The canonical Prisma muscle enum is `TargetMuscleGroup`. New seed content uses specific values such as `QUADRICEPS`, `LATS`, and `ABS`; broad legacy values remain available only for compatibility. Training level reuses the existing `TrainingLevel` enum.

## Boundaries

Current free-text `DailyPlanJson.training.exercises` remains unchanged. This batch does not link plans to the library and does not regenerate current or historical plans. `TrainingPreference` and Body Map behavior are also unchanged.

A later `ExerciseSelectionService` may select safe candidates using preferences and constraints. It must remain separate from catalog reads. Exercise endpoints are read-only and never invoke AI.

## Future plan contract

The future library-backed prescription is expected to resemble:

```ts
type PlannedExercise = {
  exerciseId: string;
  slug: string;
  sets?: number;
  reps?: string;
  durationSeconds?: number;
  restSeconds?: number;
  notes?: string;
};
```

The library defines identity and instructional content; the plan defines order and user-specific prescription. Before integration, the project must choose a localized snapshot or content-version strategy so later catalog edits cannot silently make historical plans misleading.

## Deferred

- Exercise selection and AI candidate integration
- DailyPlanJson changes and library-backed prescriptions
- Food/Training plan tabs
- Exercise Details and media carousel UI
- Completion tracking, workout history, and admin/content management

