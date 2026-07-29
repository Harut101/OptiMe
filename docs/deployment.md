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

Production must point this value to a public HTTPS CDN or media host. Database rows keep relative paths, so changing the public base URL does not require data migration.

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

The package contains approved full media and optimized thumbnails in both WebP
and the JPEG runtime fallback used by mobile. The deterministic v2 manifest
records role, format, MIME type, bounded cache metadata, size, and SHA-256 for
all 188 deployable files. It excludes inbox files, original backups, previews,
source reports, credentials, and temporary files.

Validate the artifact before upload:

```powershell
pnpm --filter @optime/api exercise-media:package:validate
```

Smoke-test a local or deployed media origin with:

```powershell
pnpm --filter @optime/api exercise-media:smoke -- --base-url=http://localhost:3000
pnpm --filter @optime/api exercise-media:smoke -- --base-url=https://media.example
pnpm --filter @optime/api exercise-media:smoke -- --base-url=https://media.example --all
```

The full smoke check validates every deployed object against the package
checksum, MIME type, minimum one-day public cache policy, and expected `404`
behavior for missing media.

No production CDN credentials are stored in the repository. Actual upload and
DNS activation remain external deployment actions. Follow
[media-cdn-release.md](./media-cdn-release.md).
