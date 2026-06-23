# AI Daily Plan Generation

Daily plan generation selects deterministic protocols and ExerciseLibrary candidates before invoking `AiProvider`. OpenAI receives a bounded allowlist and must use exact `exerciseId` and `slug` values without inventing, renaming, or substituting exercises.

Provider output is schema-validated, food names are normalized, and exercises are checked for allowed identity, slug match, uniqueness, exact requested count, and bounded sets/reps/rest/duration. Trusted catalog fields overwrite model text. Invalid exercise output receives one retry containing machine-readable reason codes only. A second failure produces a deterministic candidate-backed workout; provider/schema failure still uses the normalized full safe fallback plan.

Deterministic `SafetyService` and the optional Safety Agent continue after validation. Safety Agent retry output uses the same candidates and cannot introduce an identity. Logs contain only protocol/mode/counts/reason codes/retry/fallback/final IDs/locale, never prompts, raw health values, private notes, or chain-of-thought.

The mobile Food/Training views, thumbnail batch request, Exercise Details route, and media carousel are read-only. They never call OpenAI or any generation endpoint. Live media loading is deliberately separate from generated immutable exercise snapshots.
