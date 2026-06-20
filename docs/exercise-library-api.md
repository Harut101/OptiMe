# ExerciseLibrary API

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
- `page` (default `1`)
- `pageSize` (default `20`, maximum `50`)

Filters can be combined. Search performs a simple case-insensitive match against requested-locale and English names/descriptions. Ordering is `sortOrder`, then `slug`. Pagination returns `page`, `pageSize`, `totalItems`, and `totalPages`.

Each list item contains stable identity, localized name, category, muscles, equipment, `resolvedLocale`, and a primary thumbnail or `null`. Thumbnail resolution is active primary media, then `thumbnailUrl`, then its full URL.

## Detail

`:idOrSlug` accepts either stable identifier. The response includes localized content, ordered active media, and classification metadata. Media order is `sortOrder`, then stable ID. Missing and inactive exercises return `404`; a zero-media exercise returns `media: []`.

## Locale

`Accept-Language` is validated through the shared locale resolver. Resolution is requested supported locale, then `en-US`; unsupported input resolves to English. Exercise and media translations use the same fallback and include the exercise `resolvedLocale`. Switching language is a response projection only and never mutates catalog data.

