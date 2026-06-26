# Deployment Notes

## Exercise Media

Local development serves approved copied media from:

```txt
apps/api/public/exercise-media
```

The public route is:

```txt
/exercise-media/<exercise-slug>/<filename>
```

Configure `EXERCISE_MEDIA_PUBLIC_BASE_URL` to resolve relative database URLs in API responses:

```txt
EXERCISE_MEDIA_PUBLIC_BASE_URL=http://localhost:3000
```

Production can point this value to a CDN or media host later. Database rows keep relative paths, so changing the public base URL does not require data migration.

The app serves stable filenames, not content-hashed paths, so local static serving uses a bounded cache:

```txt
Cache-Control: public, max-age=86400
```

Longer immutable CDN caching should use content-hash paths or deterministic checksum query versions in a future deployment batch.

The source inbox at `apps/mobile/assets/exercise-media/inbox` is not served publicly. Normalization backups and review previews are also private workspace assets:

```txt
apps/mobile/assets/exercise-media/source-originals/
apps/mobile/assets/exercise-media/previews/
```

Do not deploy those private folders as public static media. Only copied assets under `apps/api/public/exercise-media` should be served.

## Exercise Media Package

Create the provider-neutral media artifact with:

```powershell
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
pnpm --filter @optime/api exercise-media:package
```

Output:

```txt
apps/api/build/exercise-media-package/
```

The package contains only public approved full WebPs and optimized thumbnails plus a deterministic checksum manifest. It excludes inbox files, original backups, previews, JSON reports, credentials, and temporary files.

Smoke-test a local or deployed media origin with:

```powershell
pnpm --filter @optime/api exercise-media:smoke -- --base-url=http://localhost:3000
pnpm --filter @optime/api exercise-media:smoke -- --base-url=https://media.example
```

No production CDN provider is configured in the repository yet. Actual upload remains pending provider selection/configuration.
