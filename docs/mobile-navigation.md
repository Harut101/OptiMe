# Mobile Navigation

OptiMe uses Expo Router.

Primary tabs remain:

- Today
- Food
- Training
- Profile

Training remains visible even when app mode is `NUTRITION_ONLY`. In that state, the Training tab shows a disabled state and an Enable Training action instead of hiding the module.

Goal and mode editing uses the existing standalone `goal-editor` route. Mode and primary goal changes show a confirmation before saving and do not regenerate Daily Plans.

The Design System Preview is an internal route and is reachable from Profile settings only in development.

Plan Details Training can open the standalone `workout-session` route. This route is not a primary tab; it is a focused execution screen for the selected Daily Plan workout.

Workout history is a standalone route opened from Training and Profile. Completed workout details reuse `workout-session` in read-only mode.
## Food Tracking Navigation

- Today keeps food tracking read-only with a compact progress card.
- Food tab is the primary place for quick meal completion.
- Meal Details supports meal-specific completion changes, regeneration, ingredient exclusion, and preparation details.
