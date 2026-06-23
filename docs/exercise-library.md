# ExerciseLibrary

ExerciseLibrary is the language-neutral catalog of exercises. It provides stable IDs and slugs, classification, localized instructional content, and optional media. It does not choose exercises for a user, inspect health data, call OpenAI, or modify a Daily Plan.

## Persistence

`Exercise` owns stable catalog metadata: category, movement pattern, equipment, target and secondary muscles, supported training levels, conservative contraindication tags, active state, and deterministic sort order. `ExerciseTranslation` owns localized name, description, ordered instructions, coaching cues, and safety notes. Deleting an exercise cascades to its translations and media.

Identity never depends on a translated name. Slugs are globally unique and remain untranslated. Translation rows are unique by exercise and locale. The supported locales are the existing `en-US`, `ru-RU`, `fr-FR`, and `zh-CN` contract; API projection resolves the requested locale and falls back to English.

Approved media filenames must use the exact seeded `Exercise.slug`. Reconciliation imports `exerciseCatalog` directly rather than maintaining a second slug list or querying mutable local database state. Similar muscle targets do not make two exercises interchangeable.

The canonical Prisma muscle enum is `TargetMuscleGroup`. New seed content uses specific values such as `QUADRICEPS`, `LATS`, and `ABS`; broad legacy values remain available only for compatibility. Training level reuses the existing `TrainingLevel` enum.

## Planning boundary

`ExerciseSelectionService` now uses internal localized catalog reads to build a safe allowlist. Exercise endpoints remain read-only and never invoke AI. TrainingPreference and Body Map persistence are unchanged.

## Plan contract

The future library-backed prescription is expected to resemble:

```ts
type PlannedExercise = {
  exerciseId?: string;
  slug?: string;
  sets?: string;
  reps?: string;
  durationSeconds?: number;
  restSeconds?: number;
  notes?: string;
};
```

The library defines identity and instructional content; the plan defines order and user-specific prescription. New generated exercises store stable identity plus an immutable localized snapshot with catalog `updatedAt`. Old free-text exercises remain valid and historical JSON is not rewritten.

## Deferred

- Approved media ingestion, storage/CDN registration, and database records
- Completion tracking, workout history, and admin/content management

## Review-only expansion

The deterministic [exercise-media catalog alignment](./exercise-media-catalog-alignment.md) approved 31 distinct exercises and two safe aliases. The ExerciseLibrary seed now expands from 46 to 77 exercises and 308 translations while preserving every original slug. Catalog expansion is preferred over replacing stable slugs because it preserves historical plan snapshots, selection behavior, protocol matching, and user preferences.

ExerciseMedia ingestion remains separate from catalog identity. The current approved media manifest is blocked by five aspect-ratio validation failures, so the database still has no media rows until those assets are corrected or the media requirement changes.
