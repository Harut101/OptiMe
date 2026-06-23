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

The source inbox at `apps/mobile/assets/exercise-media/inbox` is not served publicly. Normalization backups and review previews are also private workspace assets:

```txt
apps/mobile/assets/exercise-media/source-originals/
apps/mobile/assets/exercise-media/previews/
```

Do not deploy those private folders as public static media. Only copied assets under `apps/api/public/exercise-media` should be served.
