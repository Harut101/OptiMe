# Exercise Selection Service

`ExerciseSelectionService` is the deterministic boundary between user planning context and ExerciseLibrary-backed Daily Plans. It reads active, localized catalog records through `ExercisesService`; it never calls AI, saves plans, diagnoses conditions, or mutates preferences/catalog content.

## Input and normalization

The internal context contains only locale, local plan date, selected training protocol, optional `GYM`/`HOME` environment, concrete equipment, training level, target muscles, workout duration, limitations presence, pregnancy context, safe-mode/minor flags, boolean health signals, and `PlanQualityMode`. It excludes raw weight, heart rate, sleep, steps, limitations text, tokens, and identifying data.

Legacy muscle groups normalize once without being written back: `ARMS` becomes biceps/triceps/forearms, `BACK` becomes traps/lats/lower back (the canonical enum has no `UPPER_BACK`), `CORE` becomes abs/obliques, and `LEGS` becomes glutes/quadriceps/hamstrings/adductors/abductors/calves. Specific targets remain unchanged and duplicates are removed.

## Eligibility and ranking

Only active exercises are considered. `BODYWEIGHT` and `NONE` are universally available; every other required equipment value must be explicitly saved. `GYM` and `HOME` remain environments and do not imply equipment. Missing equipment selects a bodyweight-only pool.

Level eligibility is hierarchical. Advanced eligibility is not a preference for complexity. Pregnancy/postpartum review tags and high-impact recovery contexts are conservatively excluded before AI.

Named scores prioritize exact targets, secondary targets, protocol movement/category fit, equipment, level, lower complexity, recovery signals, and accessible movement. Catalog `sortOrder` then slug are stable tie-breakers. Target coverage is promoted when availability permits.

Duration requests 3 exercises up to 20 minutes, 4 up to 35, 5 up to 50, and 6 after 50 minutes. Recovery signals reduce this by one. The candidate pool is larger than the workout and bounded to 6-16 entries. `NO_TRAINING_PLANNED` requests no exercises.

## Result and fallback

The internal result includes candidates, requested count, pool limit, normalized targets, fallback mode, and aggregate exclusion counts. Scores and reasons remain internal. Fallback modes are `NONE`, `BODYWEIGHT_ONLY`, `RECOVERY_FOCUSED`, and `MINIMAL_SAFE_POOL`; safety exclusions are never relaxed and exercises are never invented.

AI receives a reduced candidate projection without ranking data, contraindication tags, database timestamps, media, or Prisma rows. Backend validation restores names, classification, instructions, cues, safety notes, and immutable localized snapshots from trusted candidates.

