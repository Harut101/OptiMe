# Training Preferences

Training preferences are optional profile details used to improve training recommendations. They must not block first plan generation.

Stage 1 onboarding remains safety-first and short. Training preferences belong mostly to Stage 2 progressive profile prompts.

## Fields

### targetMuscleGroups

Body areas or muscle groups the user wants to improve.

Example values:

- `CHEST`
- `BACK`
- `LEGS`
- `GLUTES`
- `CORE`
- `SHOULDERS`
- `ARMS`
- `FULL_BODY`

Use:

- Personalize exercise suggestions.
- Shape Plus and Pro training recommendations.
- Keep Free recommendations simple but still useful.

### trainingOutcome

The user's main training direction.

Example values:

- `STRENGTH`
- `MUSCLE_GROWTH`
- `ENDURANCE`
- `MOBILITY`
- `GENERAL_FITNESS`

Use:

- Select training protocol.
- Influence exercise style, sets, reps, duration, and intensity cues.

### equipment

Available training equipment.

Example values:

- `GYM`
- `HOME`
- `DUMBBELLS`
- `BODYWEIGHT`
- `MACHINES`

Use:

- Avoid suggesting unavailable equipment.
- Make Plus and Pro exercise recommendations more practical.

### trainingLevel

Current training experience.

Example values:

- `BEGINNER`
- `INTERMEDIATE`
- `ADVANCED`

Use:

- Keep exercise difficulty level-appropriate.
- Avoid unsafe progression.
- Adjust explanation depth.

### limitationsOrPainAreas

Safety-sensitive limitations, pain areas, or movement concerns.

Examples:

- knee pain
- lower back discomfort
- shoulder limitation
- dizziness during intense workouts

Use:

- Prioritize conservative training guidance.
- Influence recovery protocol.
- Trigger safety checks.

This field is safety-sensitive and should be collected early in progressive prompts. It must not be treated as a diagnosis.

### preferredTrainingDays

Optional preferred training days.

Example values:

- `0` for Sunday
- `1` for Monday
- `6` for Saturday

Use:

- Later schedule refinement.
- Avoid overbuilding in Sprint 6.

## Safety-Sensitive Fields

Safety-sensitive:

- `limitationsOrPainAreas`
- training notes that mention pain, injury, dizziness, illness, exhaustion, or unusual fatigue
- pregnancy, postpartum, or breastfeeding context from profile
- under-18 safe mode

Not safety-sensitive by themselves:

- target muscle groups
- equipment
- training outcome
- training level
- preferred training days

## Progressive Prompt Collection

Recommended prompt order:

1. `limitationsOrPainAreas`
2. `equipment`
3. `trainingLevel`
4. `targetMuscleGroups`
5. `trainingOutcome`
6. `preferredTrainingDays`

Prompt rules:

- Ask one prompt at a time.
- Do not block plan generation.
- Allow skip with cooldown.
- Keep copy supportive and non-medical.
- Use answers immediately in future plan context when available.

## Why Preferences Must Not Block Plan Generation

The user should see value quickly. Missing training preferences should use safe defaults:

- target muscles: `FULL_BODY`
- training outcome: based on goal, or `GENERAL_FITNESS`
- equipment: `BODYWEIGHT`
- training level: `BEGINNER`
- limitations: none reported

Safety-critical signals still override defaults. If a user reports pain, dizziness, illness, exhaustion, or injury, the plan should become more conservative across all tiers.
