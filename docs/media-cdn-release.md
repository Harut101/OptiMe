# Exercise Media CDN Release

## Decision

Exercise media should be served from public object storage behind an HTTPS CDN
for the first production release. The API keeps relative database paths and
returns absolute media URLs using `EXERCISE_MEDIA_PUBLIC_BASE_URL`.

The repository does not depend on a specific provider. Cloudflare R2 with a
custom domain is the preferred small-team option; S3-compatible storage with a
CDN is also supported.

## Repository-Owned Preparation

Generate and validate the provider-neutral artifact:

```powershell
$env:DATABASE_URL='postgresql://optime:optime@localhost:5432/optime?schema=public'
pnpm --filter @optime/api exercise-media:package
pnpm --filter @optime/api exercise-media:package:validate
```

Artifact:

```txt
apps/api/build/exercise-media-package/
  exercise-media/
  exercise-media-package-manifest.json
```

The package contains only the 188 production runtime objects:

- 47 full WebPs;
- 47 optimized WebP thumbnails;
- 47 full JPEG mobile fallbacks;
- 47 JPEG thumbnail fallbacks.

Do not upload `inbox`, `source-originals`, `previews`, source reports, or any
workspace directory outside the generated package.

## Object Metadata Contract

Apply the metadata from `exercise-media-package-manifest.json` to every object:

```txt
Content-Type: image/webp | image/jpeg
Cache-Control: public, max-age=86400
```

Paths are stable and not content-hashed, so do not mark them `immutable`.
Replacing an existing object requires a CDN purge. Future content-addressed
media can safely use a longer immutable cache policy.

The CDN must:

- preserve object paths below `/exercise-media/`;
- support public `GET` and `HEAD`;
- return the declared MIME type;
- return `404` for missing objects instead of an HTML success page;
- avoid cookies, authentication redirects, directory listing, and URL
  credentials;
- use HTTPS with a valid public certificate;
- avoid exposing the storage provider's write credentials.

## External Provider Setup

1. Create a public-read media bucket with private write credentials.
2. Attach a custom domain such as `media.optime.app`.
3. Upload only the generated package's `exercise-media/` directory.
4. Apply each manifest item's `contentType` and `cacheControl`.
5. Configure DNS and TLS.
6. Keep bucket write keys in the deployment secret manager, never in mobile,
   API environment committed files, or CI logs.
7. Set production API configuration:

```env
EXERCISE_MEDIA_PUBLIC_BASE_URL=https://media.optime.app
```

Production startup rejects a missing, HTTP, localhost, or credential-bearing
media base URL.

## Verification

Run a representative smoke check first:

```powershell
pnpm --filter @optime/api exercise-media:smoke -- --base-url=https://media.optime.app
```

Then verify every object byte-for-byte:

```powershell
pnpm --filter @optime/api exercise-media:smoke -- --base-url=https://media.optime.app --all
```

The full smoke check must report:

- all 188 objects return `200`;
- WebP and JPEG MIME types are correct;
- cache policy is public with `max-age` of at least 86400;
- response bytes match package SHA-256 values;
- a missing object returns `404`.

After setting the API environment, verify the Exercise list, Plan Details,
Workout Session, and Exercise Details on physical iOS and Android builds.
Missing media must retain the existing text fallback and must never block a
workout or Daily Plan.

## Rollback

CDN deployment does not change database paths. Roll back by restoring the prior
CDN objects or setting `EXERCISE_MEDIA_PUBLIC_BASE_URL` to another approved
public HTTPS media origin. Do not point a production build to localhost or a
private network address.
