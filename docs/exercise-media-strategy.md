# Exercise media strategy

An exercise may have zero, one, or many `ExerciseMedia` rows. Types are `PRIMARY`, `TECHNIQUE`, `ANATOMY`, and `ALTERNATE`. Media represents different views of one exercise, not different exercises; Machine Leg Press, Single-Leg Press, and Incline Leg Press are separate identities when technique or safety context differs.

Only one active primary item is allowed per exercise. Active media is ordered deterministically. Dimensions must both be positive or both absent. `ExerciseMediaTranslation` localizes alt text and caption with requested-locale then English fallback.

Rights metadata (`source`, `license`, and `attribution`) is retained internally for audit support but is not legal verification and is not returned by normal mobile APIs. Content must not use random internet images, watermarked assets, placeholder domains, or unlicensed downloads. Missing media is a supported text-only state.

Exercise Details uses a portrait `4:5` outer media card, native horizontal paging, and pagination dots for multiple items. Source media uses contain behavior rather than destructive cropping. Zero media is a first-class text fallback; one item has no dots; multiple items retain deterministic API order. Media ingestion, object storage/CDN delivery, upload/admin tooling, and licensing approval workflows remain deferred.

## Filename reconciliation

Approved WebPs are staged in `apps/mobile/assets/exercise-media/inbox`. The strict filename is `<Exercise.slug>_anatomy-<two-digit-index>.webp`; index `00` is invalid. `Exercise.slug` from the deterministic seed catalog is authoritative. Localized names, muscles, equipment, fuzzy similarity, and AI are never identity sources.

Run `pnpm --filter @optime/api exercise-media:reconcile` for a dry run. The explicit apply form adds `-- --apply`, but refuses mutation while any invalid, missing, ambiguous, duplicate, conflict, or coverage blocker remains. Reconciliation can rename reviewed aliases only; it never edits image bytes or database records.

The current inbox contains 47 WebPs and 46 unique parsed image slugs. `russian-twist_anatomy-01.webp` and `russian-twist_anatomy-02.webp` are valid separate source indexes, not duplicates.

## Catalog alignment proposal

The review-only [catalog alignment](./exercise-media-catalog-alignment.md) classifies all 33 unmatched identities. Filename aliases are reserved for materially identical movements; similar muscles alone never justify an alias. Distinct equipment, loading, body position, laterality, range of motion, or technique support a separate exercise candidate.

The approved proposal preserves all 46 original exercises, adds 31 candidates, and yields a catalog size of 77. Two alignment-level identities are safe aliases: `cable-row` and `calf-raise`. `hip-thrust_anatomy-01.webp` and `barbell-hip-thrust_anatomy-01.webp` remain separate media identities, so no Hip Thrust index rename is proposed.

Approved filename reconciliation has been applied. The inbox now has 47 canonical files, 46 canonical media exercise identities, zero unmatched image slugs, and zero filename blockers. The five formerly blocked `2:3` WebPs were normalized with contain plus side padding; all 47 files now pass validation and are registered as `ExerciseMedia`.

Normalization details, backup paths, and preview artifacts are documented in [exercise-media-normalization.md](./exercise-media-normalization.md). Optimized `480x600` thumbnails are generated from public full media and stored beside each exercise under `thumbnails/`; details are documented in [exercise-media-thumbnails.md](./exercise-media-thumbnails.md). Production CDN upload remains deferred until a provider is selected.
