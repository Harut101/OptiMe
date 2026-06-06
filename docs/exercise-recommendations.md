# Exercise Recommendations

Sprint 6 should add a text-only exercise recommendation foundation.

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

## Optional DailyPlanJson Extension Proposal

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

## Backward Compatibility

Existing mobile uses:

- `training.recommendation`
- `training.intensity`
- `training.notes`

`training.exercises` must be optional. Existing mobile must still work when the field is absent.

Future mobile can render exercise cards in Plan Details only. Today should stay clean.

## Tier Behavior

`BASIC`:

- Simple exercise suggestions.
- Minimal detail.
- Safe and practical.

`PERSONALIZED`:

- Target muscle groups.
- Equipment-aware exercise choices.
- Training level awareness.
- Sets, reps, and rest when safe.

`ADAPTIVE`:

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
