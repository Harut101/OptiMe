# AI Daily Plan Generation

Daily plan generation selects deterministic protocols and ExerciseLibrary candidates before invoking `AiProvider`. OpenAI receives a bounded allowlist and must use exact `exerciseId` and `slug` values without inventing, renaming, or substituting exercises.

Provider output is schema-validated, food names are normalized, and exercises are checked for allowed identity, slug match, uniqueness, exact requested count, and bounded sets/reps/rest/duration. Trusted catalog fields overwrite model text. Invalid exercise output receives one retry containing machine-readable reason codes only. A second failure produces a deterministic candidate-backed workout; provider/schema failure still uses the normalized full safe fallback plan.

Before provider generation, `WorkoutVolumePlanner` calculates deterministic duration-based training constraints. OpenAI receives the requested exercise count, min/max count, workout duration, suggested set count, suggested rest seconds, estimated session minutes, and safe volume reason codes. Duration is a hard planning constraint: a 60-90 minute normal strength workout should not return only 2-3 exercises unless the context includes a safety, recovery, level, pregnancy/postpartum, under-18, pain/limitation, or insufficient-candidate reason.

Exercise validation compares model output to the deterministic request. Too few exercises for longer sessions are rejected and retried unless the backend already reduced volume for a safe reason. The provider still cannot invent exercises to satisfy count; if the safe candidate pool is smaller than the target, the backend records `NOT_ENOUGH_SAFE_EXERCISES` and plans a smaller safe workout.

Deterministic `SafetyService` and the optional Safety Agent continue after validation. Safety Agent retry output uses the same candidates and cannot introduce an identity. Logs contain only protocol/mode/counts/reason codes/retry/fallback/final IDs/locale, never prompts, raw health values, private notes, or chain-of-thought.

The mobile Food/Training views, thumbnail batch request, Exercise Details route, and media carousel are read-only. They never call OpenAI or any generation endpoint. Live media loading is deliberately separate from generated immutable exercise snapshots.
