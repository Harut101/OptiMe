# Exercise Selection Service

`ExerciseSelectionService` is the deterministic boundary between user planning context and ExerciseLibrary-backed Daily Plans. It reads active, localized catalog records through `ExercisesService`; it never calls AI, saves plans, diagnoses conditions, or mutates preferences/catalog content.

## Input and normalization

The internal context contains only locale, local plan date, selected training protocol, optional `GYM`/`HOME` environment, concrete equipment, training level, target muscles, workout duration, limitations presence, pregnancy context, safe-mode/minor flags, boolean health signals, and `PlanQualityMode`. It excludes raw weight, heart rate, sleep, steps, limitations text, tokens, and identifying data.

Legacy muscle groups normalize once without being written back: `ARMS` becomes biceps/triceps/forearms, `BACK` becomes traps/lats/lower back (the canonical enum has no `UPPER_BACK`), `CORE` becomes abs/obliques, and `LEGS` becomes glutes/quadriceps/hamstrings/adductors/abductors/calves. Specific targets remain unchanged and duplicates are removed.

## Eligibility and ranking

Only active exercises are considered. `BODYWEIGHT` and `NONE` are universally available; every other required equipment value must be explicitly saved. `GYM` and `HOME` remain environments and do not imply equipment. Missing equipment selects a bodyweight-only pool.

Level eligibility is hierarchical. Advanced eligibility is not a preference for complexity. Pregnancy/postpartum review tags and high-impact recovery contexts are conservatively excluded before AI.

Named scores prioritize exact targets, secondary targets, protocol movement/category fit, equipment, level, lower complexity, recovery signals, and accessible movement. Catalog `sortOrder` then slug are stable tie-breakers. Target coverage is promoted when availability permits.

## Duration-Based Workout Volume

`WorkoutVolumePlanner` converts routine-day duration and safety context into deterministic workout volume before exercise candidates are selected.

Base tiers:

- 15-25 minutes: target 2 exercises, range 2-3.
- 26-35 minutes: target 4 exercises, range 3-4.
- 36-50 minutes: target 5 exercises, range 4-5.
- 51-65 minutes: target 6 exercises, range 5-6.
- 66-80 minutes: target 7 exercises, range 6-7.
- 81+ minutes: target 8 exercises, range 7-8.

The planner also estimates suggested sets per exercise, suggested rest seconds, and total session minutes using warm-up, work, rest, transition, and cool-down buffers. These values are planning guidance only; they do not create a live timer.

Safety can reduce volume for beginner level, safe mode/minor users, pregnancy/postpartum/breastfeeding context, current pain or limitations, low sleep, high recent activity, recovery-focused protocols, or too few safe eligible candidates. Without one of those reasons, a normal 60-90 minute strength plan should not return only 2-3 exercises.

The candidate pool is sized from the planned max exercise count and remains bounded. `NO_TRAINING_PLANNED` requests no exercises.

## Result and fallback

The internal result includes candidates, requested count, min/max count, workout volume plan, pool limit, normalized targets, fallback mode, and aggregate exclusion counts. Scores and reasons remain internal. Fallback modes are `NONE`, `BODYWEIGHT_ONLY`, `RECOVERY_FOCUSED`, `MINIMAL_SAFE_POOL`, and `NOT_ENOUGH_SAFE_EXERCISES`; safety exclusions are never relaxed and exercises are never invented.

AI receives a reduced candidate projection without ranking data, contraindication tags, database timestamps, media, or Prisma rows. Backend validation restores names, classification, instructions, cues, safety notes, and immutable localized snapshots from trusted candidates.
