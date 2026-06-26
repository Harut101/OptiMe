# ExerciseLibrary API

Daily plan selection uses `ExercisesService.getActiveForSelection()` internally, sharing locale resolution and English fallback with this read API. The internal projection is not public and does not expose scores, selection reasons, or planning context.

Exercise media URLs are stored as relative paths and resolved at response time with `EXERCISE_MEDIA_PUBLIC_BASE_URL` when configured. API responses never expose local filesystem paths, inbox paths, source/license metadata, or raw storage directories. Exercise summaries return optimized thumbnails when available and `thumbnail: null` only for exercises without active media.

Both routes require the existing JWT guard:

- `GET /v1/exercises`
- `GET /v1/exercises/:idOrSlug`

Responses are mapped shared contracts, not raw Prisma records. Inactive exercises and inactive media are never returned. Normal mobile responses omit media rights metadata.

## List

Supported optional query parameters use stable enum values:

- `category`
- `equipment`
- `targetMuscle`
- `trainingLevel`
- `movementPattern`
- `search`
- `ids` (comma-separated stable IDs, maximum `16`)
- `page` (default `1`)
- `pageSize` (default `20`, maximum `50`)

Filters can be combined. Search performs a simple case-insensitive match against requested-locale and English names/descriptions. Ordering is `sortOrder`, then `slug`. Pagination returns `page`, `pageSize`, `totalItems`, and `totalPages`.

The bounded `ids` filter lets a Daily Plan load card summaries and primary thumbnails in one authenticated request instead of making one detail request per card. Results remain active-only, locale-aware, and deterministically ordered; missing or inactive IDs are omitted without failing the request.

Each list item contains stable identity, localized name, category, muscles, equipment, `resolvedLocale`, and a primary thumbnail or `null`. Thumbnail resolution uses active primary media and prefers `thumbnailUrl`, falling back to the full URL only when the thumbnail URL is absent.

## Detail

`:idOrSlug` accepts either stable identifier. The response includes localized content, ordered active media, full media `url`, optional `thumbnailUrl`, and classification metadata. Exercise Details should render `url`; cards should render the list thumbnail. Media order is `sortOrder`, then stable ID. Missing and inactive exercises return `404`; a zero-media exercise returns `media: []`.

## Locale

`Accept-Language` is validated through the shared locale resolver. Resolution is requested supported locale, then `en-US`; unsupported input resolves to English. Exercise and media translations use the same fallback and include the exercise `resolvedLocale`. Switching language is a response projection only and never mutates catalog data.
