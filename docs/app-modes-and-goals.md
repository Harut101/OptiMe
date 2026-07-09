# App Modes and Goals

OptiMe supports two first-class app modes:

- `NUTRITION_ONLY`
- `NUTRITION_AND_TRAINING`

The app mode is persisted on the goal record through `GoalImpactMode`. This keeps the implementation aligned with the existing model while making the product behavior clearer: training is optional, and a user can turn it off without deleting saved training preferences or weekly schedule settings.

Primary goals are normalized through `PrimaryGoal`:

- `WEIGHT_LOSS`
- `WEIGHT_MAINTENANCE`
- `WEIGHT_GAIN`
- `HEALTHY_EATING`

The older `GoalType` field remains for compatibility with existing safety rules, onboarding, and historical clients. New mobile UI shows the product-facing primary goal labels and maps them to compatible `GoalType` values.

Mode and goal changes affect future plans only. Existing Daily Plans are not regenerated and historical plan JSON is not mutated.

When app mode is `NUTRITION_ONLY`:

- Daily food planning remains enabled.
- Deterministic nutrition targets use `dayType = NUTRITION_ONLY`.
- Training schedule and workout energy do not affect calorie or macro targets.
- Exercise selection is skipped.
- Training exercises are normalized to an empty list.
- The saved weekly schedule and training preferences remain stored.
- Today shows a neutral training-off state.
- Training tab remains visible and offers an Enable Training action.

When app mode is `NUTRITION_AND_TRAINING`, the existing training, protocol, exercise selection, and weekly schedule behavior remains available.

During onboarding, `NUTRITION_AND_TRAINING` enables training guidance but does not force weekly routine setup. After nutrition preferences are saved, mobile shows an optional next step to set up the Weekly Routine now or skip and continue to Today. Skipping does not disable training; it uses safe default training behavior until the Training tab is configured.

Safety is not paywalled or mode-gated. Pain, illness, dizziness, exhaustion, under-18 rules, allergy rules, pregnancy/postpartum context, and dangerous-goal validation still apply in every mode.

Pricing is also mode-independent. `NUTRITION_ONLY` users can be Free, Plus, or Pro and still benefit from nutrition planning, food preferences, meal/menu regeneration, food tracking, and health-aware context. Training-specific paid depth applies only when Training is enabled, but safety behavior stays available in all modes.

Mobile Profile shows goal and app-mode context as an entry point to the standalone goal editor. It does not save goal fields through the profile payload and does not regenerate existing plans automatically.
