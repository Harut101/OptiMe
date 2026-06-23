# Approved exercise media inbox

Place reviewed source WebP files here using:

```txt
<canonical-exercise-slug>_anatomy-<two-digit-index>.webp
```

Run `pnpm --filter @optime/api exercise-media:reconcile` from the workspace root before ingestion. `Exercise.slug` from the deterministic seed catalog is the identity source. Do not infer identity from localized names, muscles, equipment, or visual similarity.

The reconciliation command ignores this README. It never edits image bytes, copies media, or writes database records. Apply mode may rename only explicitly reviewed aliases and refuses all mutation while blockers remain.
