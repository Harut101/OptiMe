# Exercise selection safety

Exercise contraindication tags are conservative internal planning/review signals, not diagnoses or guarantees. They describe considerations such as wrist load, knee load, balance, impact, position, or pregnancy/postpartum review.

ExerciseLibrary only stores and reads catalog content. `ExerciseSelectionService` now combines deterministic hard rules, limitations presence, safe mode, pregnancy/postpartum context, equipment, training level, protocol, schedule duration, and boolean health signals before an exercise becomes a plan candidate. AI may not rename or replace stable exercise identity.

Pregnancy/postpartum review tags exclude matching exercises from automatic selection. High-impact tags are excluded for minors, safe mode, reported limitations, low sleep, or high activity. Free-text limitations remain with semantic safety review; selection receives only a boolean and never logs the text.

Unknown IDs, mismatched slugs, duplicates, unsafe prescriptions, or missing prescriptions trigger one bounded retry and then a deterministic library-backed fallback. Deterministic SafetyService and Safety Agent still review the final plan.

Safety is never tier-gated. Pain, illness, dizziness, exhaustion, or loss of control must continue to produce reduced-intensity or stop guidance for every plan. Deterministic safety remains authoritative, with the Safety Agent providing semantic review after hard checks.

The seed validator rejects unsupported tags, broad new muscle targets, duplicate targets, invalid media, missing translations, and incomplete safety copy. Passing validation does not establish that an exercise is suitable for a particular person.
