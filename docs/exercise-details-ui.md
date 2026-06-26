# Exercise Details mobile UI

`/exercise-details` is a full-screen Expo Router stack route opened with `planId` and `exerciseId`; the snapshot is never serialized into the URL. The current plan cache supplies the planned item immediately. Direct, stale, or unsupported routes show a safe unavailable state.

Text follows historical ownership:

- The Daily Plan item supplies the trusted stored localized name plus sets, reps or duration, rest, intensity cue, and plan-specific notes.
- `exerciseSnapshot` supplies category, movement pattern, muscles, equipment, instructions, coaching cues, and safety notes.
- The current active ExerciseLibrary detail supplies only live media and an optional current description.

Missing or inactive live library data never removes historical snapshot or prescription content. Media failure is isolated to the media frame.

The media viewer uses a responsive portrait `4 / 5` frame, `contain` image behavior, native horizontal paging, and deterministic API ordering. Zero media shows a deliberate text fallback. One item hides indicators. Multiple items show a current-page indicator and quiet pagination dots. There is no autoplay or infinite looping.

Exercise media ingestion now registers 47 approved anatomy WebPs and 47 optimized thumbnails. Training cards render API-provided thumbnails through the exercise summary. Exercise Details renders the full media `url` from the detail response and must not downshift to thumbnails for the 4:5 viewer. The mobile client must not derive media URLs from filenames. Historical plans without media remain text-first and are not mutated by ingestion.
