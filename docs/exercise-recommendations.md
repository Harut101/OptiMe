# Exercise Recommendations

Sprint 6 Batch 4 adds a text-only exercise recommendation foundation.

Exercise recommendations are optional and should not break existing mobile screens.

## Scope

In scope:

- Text exercise names.
- Target muscles.
- Equipment.
- Optional sets, reps, rest, duration, intensity cue, and safety notes.
- PlanQualityMode-aware detail.
- Safety checks.

Out of scope:

- Exercise images.
- Exercise videos.
- Full ExerciseLibrary model.
- Exercise media hosting.
- Advanced progression engine.
- Mobile redesign.

## Optional DailyPlanJson Extension

```ts
training: {
  recommendation: string;
  intensity: 'REST' | 'LIGHT' | 'MODERATE' | 'HARD';
  notes: string;
  exercises?: Array<{
    name: string;
    targetMuscles: string[];
    equipment: string[];
    sets?: string;
    reps?: string;
    rest?: string;
    duration?: string;
    intensityCue?: string;
    safetyNotes?: string;
  }>;
}
```

Validation:

- `training.exercises` is optional.
- Maximum 8 exercises.
- `name` is required, trimmed, non-empty, max 120 characters.
- `targetMuscles` max 5 items.
- `equipment` max 5 items.
- `sets`, `reps`, and `rest` max 40 characters when present.
- `duration` max 60 characters when present.
- `intensityCue` max 160 characters when present.
- `safetyNotes` max 220 characters when present.

## Backward Compatibility

Existing mobile uses:

- `training.recommendation`
- `training.intensity`
- `training.notes`

`training.exercises` must be optional. Existing mobile must still work when the field is absent.

Sprint 6 Batch 5 renders exercises in Plan Details only when `training.exercises` has items. Today stays clean and unchanged.

Existing screens continue to render `training.recommendation`, `training.intensity`, and `training.notes`. Old plans without exercises still render normally.

Mobile rendering is text-only:

- exercise name
- target muscles
- equipment
- sets, reps, rest, or duration when present
- intensity cue when present
- supportive safety note when present

There are no images, videos, animations, or ExerciseLibrary references.

## Tier Behavior

`BASIC`:

- 0-2 simple exercise suggestions or no exercise list when rest/recovery is safer.
- Minimal detail.
- Safe and practical.
- Beginner-friendly.

`PERSONALIZED`:

- 3-4 exercises when training is appropriate.
- Target muscle groups.
- Equipment-aware exercise choices.
- Training level awareness.
- Sets, reps, and rest when safe.

`ADAPTIVE`:

- 4-5 exercises when training is appropriate.
- Deeper check-in/history adaptation.
- More nuanced intensity and recovery choices.
- Future WHOOP readiness hooks without inventing WHOOP data.

Safety is equal across all tiers.

## Safety Rules For Exercises

Exercise recommendations must:

- avoid unsafe progression
- avoid "push through pain" language
- be level-appropriate
- respect limitations and pain areas
- reduce intensity when pain/discomfort, dizziness, illness, exhaustion, or high tiredness is reported
- avoid medical diagnosis
- avoid pregnancy/postpartum unsafe high-intensity guidance
- avoid under-18 unsafe body-pressure or aggressive training language

Deterministic backend checks reject:

- training through pain, dizziness, illness, injury, exhaustion, fatigue, or discomfort
- max-effort, all-out, to-failure, 1RM, or no-pain-no-gain language when context is sensitive
- unsafe max-effort guidance for beginners
- unsafe max-effort guidance for pregnancy, postpartum, or breastfeeding context
- unsafe max-effort guidance for under-18 or `safeMode`
- unsafe max-effort guidance when pain, limitations, or high tiredness are reported
- obvious conflicts with limitations, such as telling the user to ignore knee pain

Unsafe examples:

- "Push through knee pain."
- "Go all-out even if dizzy."
- "Max effort HIIT while exhausted."
- "Ignore soreness and force the session."

Safer examples:

- "Choose light mobility if discomfort appears."
- "Keep effort easy today and stop if symptoms appear."
- "Use bodyweight options and focus on controlled movement."

## Future ExerciseLibrary

A future `ExerciseLibrary` could store:

- exercise name
- muscle groups
- equipment
- difficulty
- movement pattern
- contraindications
- instructions
- image/video references

ExerciseLibrary is explicitly deferred. Sprint 6 should prove that text-based recommendations and safety checks are useful first.
