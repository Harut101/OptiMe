# Mobile Navigation

OptiMe uses Expo Router.

Primary tabs remain:

- Today
- Food
- Training
- Profile

Onboarding contains only Profile, Goal, Nutrition Preferences, and an optional Training next-step bridge. It no longer contains Training Setup or Weekly Routine editor routes. Users who choose `NUTRITION_AND_TRAINING` can go to the Training tab from the optional bridge or skip directly to Today.

Training remains visible even when app mode is `NUTRITION_ONLY`. In that state, the Training tab shows a disabled state and an Enable Training action instead of hiding the module.

Goal and mode editing uses the existing standalone `goal-editor` route. Mode and primary goal changes show a confirmation before saving and do not regenerate Daily Plans.

The Design System Preview is an internal route and is reachable from Profile settings only in development.

Plan Details Training can open the standalone `workout-session` route. This route is not a primary tab; it is a focused execution screen for the selected Daily Plan workout.

Workout history is a standalone route opened from Training and Profile. Completed workout details reuse `workout-session` in read-only mode.

The Training tab shows Today's workout or rest day, a training-load note, Weekly Routine, Workout History, and a small Edit Training Setup action. The old visible Weekly Schedule wording is replaced by Weekly Routine. Training Setup is no longer a tab switch and no longer collects global pain/limitations or preferred training days.

Today's Generate Plan action can open the Today-only training override editor when training mode is enabled and the resolved routine day is a rest day. The return path saves `/training-overrides/:localDate`, then returns to Today with a generation continuation flag. If a plan already exists, Today asks the user to refresh instead of silently replacing it.

The recurring Weekly Routine editor is still reachable from the prompt through an explicit Edit Weekly Routine action. This keeps one-off training changes separate from the usual weekly template.

After plan replacement and training-day prompts, Today runs a soft Health Data Readiness prompt. It can ask connected Apple Health users to sync stale data, ask iOS users to connect Apple Health, or continue without data. This prompt never blocks plan generation, and Health Connect/WHOOP actions remain deferred.

Starting a workout from Plan Details Training shows a skippable pre-workout check before opening `workout-session`. This check applies only to the new workout session and does not change the Daily Plan.

Health Connections are available from Profile / Connections. The Health data route now supports Apple Health connect/sync on iOS development or production builds, while Expo Go and non-iOS platforms show safe unavailable states. Connected Apple Health shows a focused connected state, friendly last-sync formatting, and Apple Health-specific wearable metrics. Health Connect and WHOOP remain represented as future provider cards. Development mock snapshots remain available in dev builds.

The polished mobile hierarchy keeps Today, Food, Training, and Profile as primary tabs. Standalone detail routes such as Plan Details, Meal Details, Workout Session, Workout History, Health Data, Goal Editor, and Exercise Details now share consistent headers and section hierarchy while preserving their existing navigation behavior.

The app shell now uses the same elevated surface and text tokens as the card system. Header and tab styling should stay quiet and supportive rather than looking like an admin dashboard.

Active tabs use the stronger health accent for clarity on device. This is a visual-state adjustment only; navigation structure and routes are unchanged.
## Food Tracking Navigation

- Today keeps food tracking read-only with a compact progress card.
- Food tab is the primary place for quick meal completion.
- Meal Details supports meal-specific completion changes, regeneration, ingredient exclusion, and preparation details.

## Today Dashboard

Today remains the primary daily surface. Its top section now includes nutrition progress, training progress, and wearable summary cards before the existing plan overview and actions.

The dashboard does not add a new route. Health details still open through the existing Health Data route, and detailed food/training interactions remain in Food, Meal Details, Plan Details, and Workout Session.

The dashboard ring tuning is visual only. Navigation, Today data loading, pull-to-refresh, plan generation, and detail routes are unchanged.
