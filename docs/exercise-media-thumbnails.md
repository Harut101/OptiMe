# Exercise Media Thumbnails

Exercise cards use optimized thumbnails while Exercise Details continues to use full-size anatomy media.

## Settings

Generated thumbnails use deterministic settings:

```txt
format: webp
width: 480
height: 600
fit: contain
quality: 80
version: 1
```

The full approved image is proportionally resized into a `4:5` thumbnail frame. The pipeline does not crop, stretch, add labels, add watermarks, or edit full-size media bytes.

## Paths

Full media remains:

```txt
apps/api/public/exercise-media/<exercise-slug>/<filename>.webp
```

Thumbnails are stored beside the full media:

```txt
apps/api/public/exercise-media/<exercise-slug>/thumbnails/<filename>_thumb.webp
```

Example:

```txt
/exercise-media/leg-press/thumbnails/leg-press_anatomy-01_thumb.webp
```

The thumbnail is not a separate `ExerciseMedia` row. It belongs to the existing row through `ExerciseMedia.thumbnailUrl`.

## Commands

Dry run:

```powershell
pnpm --filter @optime/api exercise-media:thumbnails
```

Apply:

```powershell
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
pnpm --filter @optime/api exercise-media:thumbnails -- --apply
```

Validate:

```powershell
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
pnpm --filter @optime/api exercise-media:thumbnails:validate
```

Package for deployment:

```powershell
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
pnpm --filter @optime/api exercise-media:package
```

Local or CDN smoke test:

```powershell
pnpm --filter @optime/api exercise-media:smoke -- --base-url=http://localhost:3000
pnpm --filter @optime/api exercise-media:smoke -- --base-url=https://media.example
```

## Validation

Validation checks:

- all 47 thumbnails exist;
- every thumbnail is WebP;
- every thumbnail is exactly `480x600`;
- every thumbnail is smaller than its full-size source;
- checksum matches deterministic generation settings;
- `ExerciseMedia.thumbnailUrl` points to the expected relative path;
- full `ExerciseMedia.url` remains unchanged;
- no new media rows or media translations are created.

Current size summary:

```txt
full media bytes: 11179148
thumbnail bytes: 745602
estimated list-view transfer reduction: 93.3%
min / median / max thumbnail bytes: 8842 / 15700 / 25584
```

This is a byte-size comparison only, not a network performance guarantee.

## Cache Strategy

Media filenames are stable rather than content-hashed, so local static serving uses a bounded immutable-safe cache policy:

```txt
Cache-Control: public, max-age=86400
```

Future CDN deployment may add content-hash paths or checksum query versions if longer immutable caching is needed.

## Deployment Artifact

The package command writes a provider-neutral artifact:

```txt
apps/api/build/exercise-media-package/
  exercise-media/
    <exercise-slug>/
      <full>.webp
      thumbnails/
        <thumb>.webp
  exercise-media-package-manifest.json
```

The package includes only public full media and thumbnails. It excludes inbox files, source-original backups, previews, JSON source reports, credentials, and temporary files.

## CDN Status

No approved production media provider is configured in the repository yet. Actual production CDN upload is pending provider selection/configuration. The app is ready for any provider that can serve the packaged `exercise-media/` folder and set `EXERCISE_MEDIA_PUBLIC_BASE_URL`.
