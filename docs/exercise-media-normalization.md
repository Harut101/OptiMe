# Exercise Media Normalization

Five approved anatomy WebPs arrived as `1024x1536` assets, which is `2:3`. Exercise media requires portrait `4:5`, so validation correctly blocked ingestion instead of weakening the ratio rule.

## Corrected Files

- `barbell-hip-thrust_anatomy-01.webp`
- `bodyweight-squat_anatomy-01.webp`
- `cable-triceps-pushdown_anatomy-01.webp`
- `quadruped-leg-kickback_anatomy-01.webp`
- `standing-barbell-calf-raise_anatomy-01.webp`

Each file was normalized to `1200x1500` with contain behavior. The original `1024x1536` content fits as `1000x1500`, with `100px` side padding on the left and right. The pose, equipment, and highlighted muscles are not cropped or stretched.

## Backup And Preview

Original byte-identical backups are stored outside public serving:

```txt
apps/mobile/assets/exercise-media/source-originals/blocked-2x3/
```

A visual review contact sheet is generated at:

```txt
apps/mobile/assets/exercise-media/previews/normalized-4x5/normalized-4x5-contact-sheet.webp
```

Backups and previews are not registered as `ExerciseMedia` and are not exposed by the API static media route.

## Padding Strategy

The normalization tool samples neutral high-alpha pixels from safe corners and outer edges, then uses the median color as the canvas background. This keeps side padding visually close to the original neutral anatomy-image background and avoids obvious white, black, or colored bars.

## Commands

Dry run:

```powershell
pnpm --filter @optime/api exercise-media:normalize-blocked
```

Apply:

```powershell
pnpm --filter @optime/api exercise-media:normalize-blocked -- --apply
```

The command processes only the five explicitly approved blocked files. Apply first reruns validation and refuses to continue if any unexpected blocker is present. Windows-safe replacement uses a validated temporary output plus byte-identical backup protection.

## Validation Outcome

After normalization:

```txt
sourceFiles: 47
manifestItems: 47
mediaCoveredExercises: 46
fallbackOnlyExercises: 31
validationFailures: 0
```

No aspect-ratio exception list was added.

## Deferred

- Physical-device visual approval remains a manual QA step.
- Optimized thumbnails remain deferred.
- Production CDN deployment remains deferred.
