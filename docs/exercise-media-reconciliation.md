# Exercise media reconciliation

Source: `apps/mobile/assets/exercise-media/inbox`

The unmatched identity decisions are documented separately in [exercise-media-catalog-alignment.md](./exercise-media-catalog-alignment.md); this reconciliation baseline remains intentionally unchanged until product approval.

Exercise `slug` from the deterministic seed catalog is the only identity source. No fuzzy or AI matching is used.

Dry run: `pnpm --filter @optime/api exercise-media:reconcile`. Apply: `pnpm --filter @optime/api exercise-media:reconcile -- --apply`. Apply renames only reviewed aliases and refuses mutation while any filename blocker exists. Catalog exercises without media are supported text-only fallback states. Image bytes and database records are never modified.

## Summary

| Metric | Count |
| --- | ---: |
| catalogExercises | 77 |
| sourceFiles | 47 |
| uniqueParsedImageSlugs | 46 |
| uniqueCanonicalImageSlugs | 46 |
| exactMatches | 47 |
| aliasMatches | 0 |
| invalidFilenames | 0 |
| ambiguousAliases | 0 |
| duplicateFileNames | 0 |
| duplicateMediaIndexes | 0 |
| renameTargetConflicts | 0 |
| catalogExercisesWithoutMedia | 31 |
| imageSlugsWithoutCatalog | 0 |
| blockingErrors | 0 |

## Coverage

Catalog exercises without media: `assisted-pull-up`, `bird-dog`, `calf-stretch`, `cat-cow`, `childs-pose`, `dead-bug`, `dumbbell-bench-press`, `dumbbell-shoulder-press`, `elliptical`, `face-pull`, `front-plank`, `glute-bridge`, `glute-bridge-march`, `goblet-squat`, `hammer-curl`, `hip-flexor-stretch`, `incline-push-up`, `leg-extension`, `machine-chest-press`, `machine-row`, `one-arm-dumbbell-row`, `pallof-press`, `reverse-lunge`, `romanian-deadlift`, `seated-calf-raise`, `side-plank`, `stationary-bike`, `step-up`, `thoracic-rotation`, `walking`, `wall-push-up`

Image slugs without catalog exercise: None

Multiple source-image slugs: russian-twist (1, 2)

Multiple matched catalog exercises: russian-twist (1, 2)

Ingestion readiness: **READY**

## Explicit reviewed aliases

| Source slug | Canonical slug | Reason |
| --- | --- | --- |
| cable-crossover-fly | cable-chest-fly | Reviewed naming synonym for the seeded Cable Chest Fly exercise. |
| cable-row | seated-cable-row | Visual inspection confirms a seated bilateral cable row with foot support, matching the seeded Seated Cable Row in equipment, body position, loading, and technique. |
| calf-raise | standing-calf-raise | Visual inspection confirms an unsupported standing bodyweight calf raise, matching the seeded exercise in loading, position, range of motion, and target muscles. |
| dumbbell-back-fly | incline-dumbbell-reverse-fly | Approved catalog expansion canonical slug for dumbbell-back-fly. |
| dumbbell-bicep-curl | dumbbell-biceps-curl | Reviewed singular/plural naming difference for Dumbbell Biceps Curl. |
| dumbbell-lateral-raise | lateral-raise | The seeded Lateral Raise explicitly uses dumbbells. |
| leg-raise | lying-leg-raise | Approved catalog expansion canonical slug for leg-raise. |
| machine-hip-abductor | hip-abduction-machine | Reviewed word-order difference for Hip Abduction Machine. |
| machine-hip-adductor | hip-adduction-machine | Reviewed word-order difference for Hip Adduction Machine. |
| single-leg-kickback | quadruped-leg-kickback | Approved catalog expansion canonical slug for single-leg-kickback. |

## Items

| Source filename | Parsed slug | Canonical exercise | Canonical slug | Canonical filename | Status | Action |
| --- | --- | --- | --- | --- | --- | --- |
| back-squat_anatomy-01.webp | back-squat | Back Squat | back-squat | back-squat_anatomy-01.webp | EXACT_MATCH | No rename |
| barbell-bench-press_anatomy-01.webp | barbell-bench-press | Barbell Bench Press | barbell-bench-press | barbell-bench-press_anatomy-01.webp | EXACT_MATCH | No rename |
| barbell-curl_anatomy-01.webp | barbell-curl | Barbell Curl | barbell-curl | barbell-curl_anatomy-01.webp | EXACT_MATCH | No rename |
| barbell-hip-thrust_anatomy-01.webp | barbell-hip-thrust | Barbell Hip Thrust | barbell-hip-thrust | barbell-hip-thrust_anatomy-01.webp | EXACT_MATCH | No rename |
| barbell-shoulder-press_anatomy-01.webp | barbell-shoulder-press | Barbell Shoulder Press | barbell-shoulder-press | barbell-shoulder-press_anatomy-01.webp | EXACT_MATCH | No rename |
| barbell-shrug_anatomy-01.webp | barbell-shrug | Barbell Shrug | barbell-shrug | barbell-shrug_anatomy-01.webp | EXACT_MATCH | No rename |
| bench-dip_anatomy-01.webp | bench-dip | Bench Dip | bench-dip | bench-dip_anatomy-01.webp | EXACT_MATCH | No rename |
| bent-over-barbell-row_anatomy-01.webp | bent-over-barbell-row | Bent-Over Barbell Row | bent-over-barbell-row | bent-over-barbell-row_anatomy-01.webp | EXACT_MATCH | No rename |
| bodyweight-squat_anatomy-01.webp | bodyweight-squat | Bodyweight Squat | bodyweight-squat | bodyweight-squat_anatomy-01.webp | EXACT_MATCH | No rename |
| butterfly-stretch_anatomy-01.webp | butterfly-stretch | Butterfly Stretch | butterfly-stretch | butterfly-stretch_anatomy-01.webp | EXACT_MATCH | No rename |
| cable-bicep-curl_anatomy-01.webp | cable-bicep-curl | Cable Biceps Curl | cable-bicep-curl | cable-bicep-curl_anatomy-01.webp | EXACT_MATCH | No rename |
| cable-chest-fly_anatomy-01.webp | cable-chest-fly | Cable Chest Fly | cable-chest-fly | cable-chest-fly_anatomy-01.webp | EXACT_MATCH | No rename |
| cable-hip-adduction_anatomy-01.webp | cable-hip-adduction | Cable Hip Adduction | cable-hip-adduction | cable-hip-adduction_anatomy-01.webp | EXACT_MATCH | No rename |
| cable-triceps-pushdown_anatomy-01.webp | cable-triceps-pushdown | Cable Triceps Pushdown | cable-triceps-pushdown | cable-triceps-pushdown_anatomy-01.webp | EXACT_MATCH | No rename |
| cable-upright-row_anatomy-01.webp | cable-upright-row | Cable Upright Row | cable-upright-row | cable-upright-row_anatomy-01.webp | EXACT_MATCH | No rename |
| crunches_anatomy-01.webp | crunches | Crunches | crunches | crunches_anatomy-01.webp | EXACT_MATCH | No rename |
| deadlift_anatomy-01.webp | deadlift | Conventional Deadlift | deadlift | deadlift_anatomy-01.webp | EXACT_MATCH | No rename |
| dumbbell-biceps-curl_anatomy-01.webp | dumbbell-biceps-curl | Dumbbell Biceps Curl | dumbbell-biceps-curl | dumbbell-biceps-curl_anatomy-01.webp | EXACT_MATCH | No rename |
| farmers-carry_anatomy-01.webp | farmers-carry | Farmer’s Carry | farmers-carry | farmers-carry_anatomy-01.webp | EXACT_MATCH | No rename |
| hip-abduction-machine_anatomy-01.webp | hip-abduction-machine | Hip Abduction Machine | hip-abduction-machine | hip-abduction-machine_anatomy-01.webp | EXACT_MATCH | No rename |
| hip-adduction-machine_anatomy-01.webp | hip-adduction-machine | Hip Adduction Machine | hip-adduction-machine | hip-adduction-machine_anatomy-01.webp | EXACT_MATCH | No rename |
| hip-thrust_anatomy-01.webp | hip-thrust | Hip Thrust | hip-thrust | hip-thrust_anatomy-01.webp | EXACT_MATCH | No rename |
| incline-back-extension_anatomy-01.webp | incline-back-extension | Incline Back Extension | incline-back-extension | incline-back-extension_anatomy-01.webp | EXACT_MATCH | No rename |
| incline-dumbbell-reverse-fly_anatomy-01.webp | incline-dumbbell-reverse-fly | Incline Dumbbell Reverse Fly | incline-dumbbell-reverse-fly | incline-dumbbell-reverse-fly_anatomy-01.webp | EXACT_MATCH | No rename |
| kettlebell-sumo-squat_anatomy-01.webp | kettlebell-sumo-squat | Kettlebell Sumo Squat | kettlebell-sumo-squat | kettlebell-sumo-squat_anatomy-01.webp | EXACT_MATCH | No rename |
| lat-pulldown_anatomy-01.webp | lat-pulldown | Lat Pulldown | lat-pulldown | lat-pulldown_anatomy-01.webp | EXACT_MATCH | No rename |
| lateral-lunge-stretch_anatomy-01.webp | lateral-lunge-stretch | Lateral Lunge Stretch | lateral-lunge-stretch | lateral-lunge-stretch_anatomy-01.webp | EXACT_MATCH | No rename |
| lateral-raise_anatomy-01.webp | lateral-raise | Lateral Raise | lateral-raise | lateral-raise_anatomy-01.webp | EXACT_MATCH | No rename |
| leg-press_anatomy-01.webp | leg-press | Leg Press | leg-press | leg-press_anatomy-01.webp | EXACT_MATCH | No rename |
| lying-leg-raise_anatomy-01.webp | lying-leg-raise | Lying Leg Raise | lying-leg-raise | lying-leg-raise_anatomy-01.webp | EXACT_MATCH | No rename |
| mini-loop-band-side-lying-hip-abduction_anatomy-01.webp | mini-loop-band-side-lying-hip-abduction | Mini-Band Side-Lying Hip Abduction | mini-loop-band-side-lying-hip-abduction | mini-loop-band-side-lying-hip-abduction_anatomy-01.webp | EXACT_MATCH | No rename |
| overhead-triceps-extension_anatomy-01.webp | overhead-triceps-extension | Overhead Triceps Extension | overhead-triceps-extension | overhead-triceps-extension_anatomy-01.webp | EXACT_MATCH | No rename |
| palms-down-barbell-wrist-curl_anatomy-01.webp | palms-down-barbell-wrist-curl | Palms-Down Barbell Wrist Curl | palms-down-barbell-wrist-curl | palms-down-barbell-wrist-curl_anatomy-01.webp | EXACT_MATCH | No rename |
| palms-down-dumbbell-wrist-curl_anatomy-01.webp | palms-down-dumbbell-wrist-curl | Palms-Down Dumbbell Wrist Curl | palms-down-dumbbell-wrist-curl | palms-down-dumbbell-wrist-curl_anatomy-01.webp | EXACT_MATCH | No rename |
| push-up_anatomy-01.webp | push-up | Push-Up | push-up | push-up_anatomy-01.webp | EXACT_MATCH | No rename |
| quadruped-leg-kickback_anatomy-01.webp | quadruped-leg-kickback | Quadruped Leg Kickback | quadruped-leg-kickback | quadruped-leg-kickback_anatomy-01.webp | EXACT_MATCH | No rename |
| russian-twist_anatomy-01.webp | russian-twist | Russian Twist | russian-twist | russian-twist_anatomy-01.webp | EXACT_MATCH | No rename |
| russian-twist_anatomy-02.webp | russian-twist | Russian Twist | russian-twist | russian-twist_anatomy-02.webp | EXACT_MATCH | No rename |
| seated-cable-row_anatomy-01.webp | seated-cable-row | Seated Cable Row | seated-cable-row | seated-cable-row_anatomy-01.webp | EXACT_MATCH | No rename |
| seated-leg-curl_anatomy-01.webp | seated-leg-curl | Seated Leg Curl | seated-leg-curl | seated-leg-curl_anatomy-01.webp | EXACT_MATCH | No rename |
| seated-machine-calf-press_anatomy-01.webp | seated-machine-calf-press | Seated Machine Calf Press | seated-machine-calf-press | seated-machine-calf-press_anatomy-01.webp | EXACT_MATCH | No rename |
| standing-barbell-calf-raise_anatomy-01.webp | standing-barbell-calf-raise | Standing Barbell Calf Raise | standing-barbell-calf-raise | standing-barbell-calf-raise_anatomy-01.webp | EXACT_MATCH | No rename |
| standing-calf-raise_anatomy-01.webp | standing-calf-raise | Standing Calf Raise | standing-calf-raise | standing-calf-raise_anatomy-01.webp | EXACT_MATCH | No rename |
| standing-hip-abduction_anatomy-01.webp | standing-hip-abduction | Standing Hip Abduction | standing-hip-abduction | standing-hip-abduction_anatomy-01.webp | EXACT_MATCH | No rename |
| stiff-legged-barbell-good-morning_anatomy-01.webp | stiff-legged-barbell-good-morning | Stiff-Legged Barbell Good Morning | stiff-legged-barbell-good-morning | stiff-legged-barbell-good-morning_anatomy-01.webp | EXACT_MATCH | No rename |
| superman_anatomy-01.webp | superman | Superman | superman | superman_anatomy-01.webp | EXACT_MATCH | No rename |
| trap-bar-shrugs_anatomy-01.webp | trap-bar-shrugs | Trap-Bar Shrugs | trap-bar-shrugs | trap-bar-shrugs_anatomy-01.webp | EXACT_MATCH | No rename |
