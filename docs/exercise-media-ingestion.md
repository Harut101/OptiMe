# Exercise Media Ingestion

The approved ExerciseLibrary expansion is applied from the deterministic catalog-alignment report. The catalog now contains 77 exercises and 308 exercise translations.

## Current State

- Approved WebP source files live in `apps/mobile/assets/exercise-media/inbox`.
- Reconciliation is canonical after approved renames: 47 files, 46 media exercise identities, and 0 filename blockers.
- `hip-thrust_anatomy-01.webp` and `barbell-hip-thrust_anatomy-01.webp` remain separate files for separate exercises.
- `russian-twist_anatomy-01.webp` and `russian-twist_anatomy-02.webp` remain one exercise with two ordered anatomy media items.
- The five formerly blocked `2:3` WebPs have been normalized to exact `1200x1500` `4:5` assets. Validation now has zero blockers.

## Commands

```powershell
pnpm --filter @optime/api exercise-media:reconcile
pnpm --filter @optime/api exercise-media:validate
pnpm --filter @optime/api exercise-media:normalize-blocked
pnpm --filter @optime/api exercise-media:normalize-blocked -- --apply
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
pnpm --filter @optime/api exercise-media:ingest
```

`exercise-media:validate` is read-only. It writes a deterministic manifest and validation report, but does not copy files or write the database.

`exercise-media:ingest` reruns validation, refuses mutation if blockers exist, copies approved files to `apps/api/public/exercise-media/<exercise-slug>/`, and upserts `ExerciseMedia` plus `ExerciseMediaTranslation` rows only when validation passes.

## Normalized Validation Blockers

Five approved files originally arrived as `1024x1536` with a `2:3` aspect ratio, outside the required `4:5` ratio tolerance:

- `barbell-hip-thrust_anatomy-01.webp`
- `bodyweight-squat_anatomy-01.webp`
- `cable-triceps-pushdown_anatomy-01.webp`
- `quadruped-leg-kickback_anatomy-01.webp`
- `standing-barbell-calf-raise_anatomy-01.webp`

These were corrected with contain behavior into a `1200x1500` canvas, using side padding and preserving the original filenames. Original byte-identical backups live in:

```txt
apps/mobile/assets/exercise-media/source-originals/blocked-2x3/
```

The normalization process is documented in [exercise-media-normalization.md](./exercise-media-normalization.md). Validation was not weakened and no filenames were added to an exception list.

## Ingestion Result

After validation passed, ingestion registered:

```txt
ExerciseMedia: 47
ExerciseMediaTranslation: 188
Media-covered exercises: 46
Fallback-only exercises: 31
```

`russian-twist_anatomy-01.webp` is primary with `sortOrder: 0`; `russian-twist_anatomy-02.webp` is non-primary with `sortOrder: 1`. `hip-thrust_anatomy-01.webp` and `barbell-hip-thrust_anatomy-01.webp` remain separate primary media for separate exercises.

## Static Storage

When validation passes, ingestion copies media to:

```txt
apps/api/public/exercise-media/<exercise-slug>/<filename>
```

The API serves approved destination media under:

```txt
/exercise-media/<exercise-slug>/<filename>
```

The inbox, backup directory, and preview directory are never publicly exposed.

## CDN-Ready URLs

Database rows store environment-independent relative URLs such as:

```txt
/exercise-media/barbell-hip-thrust/barbell-hip-thrust_anatomy-01.webp
```

API responses resolve these against `EXERCISE_MEDIA_PUBLIC_BASE_URL` when configured. Changing the public base URL does not require rewriting database rows.

## Deferred

- Optimized thumbnails
- Cloud storage/CDN deployment
- Admin media upload UI
- Thumbnail optimization
- Manual physical-device visual approval for normalized assets
