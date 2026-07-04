# Training

Training guidance combines user schedule, training preferences, selected protocols, exercise library candidates, check-ins, and optional recovery-aware context.

## Recovery-Aware Guidance

When recent wearable context suggests low sleep, high activity, or recent workout load, OptiMe can:

- keep the workout controlled;
- reduce intensity or volume wording;
- suggest longer rests;
- keep recovery guidance gentler.

OptiMe must not cancel training solely from wearable data, diagnose a condition, or encourage training through pain, dizziness, illness, or exhaustion.

## Mobile polish

The Training tab now uses shared headers, section headers, and status pills for the disabled-state card, weekly schedule overview, day cards, and saved-preference summary. Workout Session and Workout History share the same visual hierarchy for progress, safety notes, completed/read-only states, and partial-completion badges.

The polish pass does not change exercise selection, weekly schedule resolution, workout execution, or workout history behavior.

## Training Tab Information Architecture

The Training tab uses a compact user-facing order:

1. Today's workout or rest-day status.
2. Training load note explaining that the current session can be adjusted safely before start.
3. Weekly Routine.
4. Workout History.
5. Small Edit Training Setup action.

User-facing copy says Weekly Routine. Backend schedule models and routes can keep their existing names for compatibility.

Training Setup is general only: training focus, level, and default equipment. Preferred training days are removed from the visible setup UI because the Weekly Routine owns days. Pain and limitations are removed from global Training Setup and are collected in the pre-workout check for the current workout session.

Environment and equipment remain separate. `HOME + BARBELL` is valid, and `GYM` does not imply any equipment. Duration belongs to each routine day.

Training setup is no longer part of onboarding. If a user chooses `NUTRITION_AND_TRAINING`, onboarding offers one optional bridge to the Training tab after nutrition preferences. Users can skip it, reach Today, and return to Training later without losing the enabled training mode.

## Generate Plan Rest-Day Prompt

Today checks the current Weekly Routine day when a training-enabled user taps Generate Plan.

- `NUTRITION_ONLY` users are not asked about training.
- Training-enabled users with a configured training day proceed directly to plan generation.
- Training-enabled users whose current weekday is a rest day are asked, "Are you training today?"
- Choosing the rest-day option generates a nutrition/recovery plan without a normal workout.
- Choosing the workout option opens a Today-only editor that saves `DailyTrainingOverride` for the current local date. It does not change the usual Weekly Routine.
- Choosing Edit Weekly Routine opens the recurring weekday editor explicitly.

Training-day users can also choose Rest today only from Today. This creates a one-off rest override and leaves the usual routine unchanged.

Move workout is available as a backend foundation: it creates a one-off rest override on the source date and a one-off training override on the target date. A fuller calendar-style mobile UI is still deferred.

## Duration-Based Workout Volume

Training duration is now a deterministic input to workout volume. The backend estimates target exercise count, min/max count, suggested sets, suggested rest, and session duration before AI writes user-facing copy.

Longer normal strength sessions should not collapse to a tiny workout without a safe reason. Safety, recovery, beginner level, pregnancy/postpartum/breastfeeding context, under-18 safe mode, current pain/limitations, or a small safe candidate pool can reduce volume without shame or pressure.

## Today training progress

The Today dashboard shows training progress from the existing plan-linked `WorkoutSession`:

- completed sessions show full progress;
- in-progress sessions use completed sets when available, otherwise completed exercises;
- rest days and nutrition-only mode show a non-pressure state instead of a percentage.

This does not change workout generation, exercise selection, safety checks, or workout history.
