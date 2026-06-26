# Exercise Media Mobile QA

Use this checklist after ExerciseMedia ingestion and API verification.

## Physical Device

- Generate or open a plan containing library-backed exercises with media.
- Confirm Training cards show optimized anatomy thumbnails when media is available.
- Confirm exercises without media keep the existing text fallback.
- Open Exercise Details for a single-media exercise and confirm the 4:5 frame uses contain behavior without cropping.
- Confirm Exercise Details uses the full media asset, not the thumbnail.
- Open Exercise Details for `russian-twist` and confirm two ordered slides appear with pagination dots.
- Confirm single-image exercises hide pagination dots.
- Confirm media loading errors preserve the exercise snapshot text.
- Confirm no backup, preview, source inbox, filesystem path, license, or attribution internals appear in mobile UI.

## Normalized Five

Check these exercises on a physical device when included in a plan or opened by detail route:

- Barbell Hip Thrust
- Bodyweight Squat
- Cable Triceps Pushdown
- Quadruped Leg Kickback
- Standing Barbell Calf Raise

For each one, confirm the full body, relevant equipment, and highlighted anatomy remain visible. Manual visual approval is not automatic from tests.

## Deferred

- Production CDN verification
- Exercise media upload/admin tooling

## Platform Status

```txt
iPhone physical device: pending
Android physical device: pending
```
