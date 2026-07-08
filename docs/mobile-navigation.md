# Mobile Navigation

## Plan Impact Prompts

Plan Impact prompts are inline cards, not separate routes. They may appear after successful saves in Today, Goals, Food, Training, and Health data. The primary action reuses the existing Today plan refresh flow; the secondary action dismisses the prompt and applies the change to future plans only.

Existing screens should keep their current navigation responsibilities. Do not route users away automatically after a preference save just because today's plan may be affected.

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

If the pre-workout check reports pain or limitation that overlaps planned exercises, Plan Details stays in the start flow and shows Adjust today, Rest today, and Continue with caution. Adjust today updates only today's DailyPlan training section. Rest today opens the existing today-only rest override path. Continue with caution requires acknowledgement before opening Workout Session.

Adjust today now opens a replacement review before mutating the plan. Users see original exercises, suggested safer replacements, and the reason that the replacement avoids the marked area. If no safe replacements are available, the same card offers Rest today and Continue with caution without changing the plan.

Post-workout check-in appears only after Finish workout on the Workout Session route. It is not shown on Today, Training, or Plan Details before completion.

Health Connections are available from Profile / Connections. The Health data route now supports Apple Health connect/sync on iOS development or production builds, while Expo Go and non-iOS platforms show safe unavailable states. Connected Apple Health shows a focused connected state, friendly last-sync formatting, and Apple Health-specific wearable metrics. Health Connect and WHOOP remain represented as future provider cards. Development mock snapshots remain available in dev builds.

The polished mobile hierarchy keeps Today, Food, Training, and Profile as primary tabs. Standalone detail routes such as Plan Details, Meal Details, Workout Session, Workout History, Health Data, Goal Editor, and Exercise Details now share consistent headers and section hierarchy while preserving their existing navigation behavior.

The app shell now uses the same elevated surface and text tokens as the card system. Header and tab styling should stay quiet and supportive rather than looking like an admin dashboard.

Active tabs use the stronger health accent for clarity on device. This is a visual-state adjustment only; navigation structure and routes are unchanged.
## Food Tracking Navigation

- Today keeps food tracking read-only with a compact progress card.
- Food tab is the primary place for quick meal completion.
- Meal Details supports meal-specific completion changes, regeneration, ingredient exclusion, and preparation details.

Food and Meal Details now share the redesigned food dashboard pattern. Food owns at-a-glance target/progress/cards; Meal Details owns focused per-meal actions and details. Confirmations use app feedback sheets instead of native alerts.

## Today Dashboard

Today remains the primary daily surface. Its top section now includes nutrition progress, training progress, and wearable summary cards before the existing plan overview and actions.

The dashboard does not add a new route. Health details still open through the existing Health Data route, and detailed food/training interactions remain in Food, Meal Details, Plan Details, and Workout Session.

Today also shows a compact Weight Progress card when profile/weight data is available. Full weight history and manual update controls live in Profile so Today stays focused.

The dashboard ring tuning is visual only. Navigation, Today data loading, pull-to-refresh, plan generation, and detail routes are unchanged.

## Screen Content Boundaries

Today is the daily command center, not a full detail screen. It should show high-level progress, wearable context, plan summary, and generation actions. Permanent usage counters, full meal detail, workout execution controls, and profile settings belong to their own screens.

Usage limits are contextual: if the user reaches a generation or refresh limit, Today shows the friendly limit message near the action and keeps the existing plan visible. The app should not show always-on quota text on the Today dashboard.

Food, Training, Health Data, Plan Details, and Profile keep their own responsibilities so users can predict where to go next instead of reading the same content in multiple places.

Profile owns personal details, goals entry points, settings, health/safety context, and weight history. Updating weight from Profile or Today affects future plans only; saved DailyPlans remain unchanged.

Meal and menu regeneration limits are also contextual. Food and Meal Details keep the current plan visible when a limit is reached and show localized “upgrade coming soon” placeholder copy instead of a broken purchase flow.
# Visual Design v2 Navigation Notes

The tab structure remains Today, Food, Training, and Profile. Health Data and Design System Preview remain routed screens, not primary tabs.

Today is the dashboard entry. Food owns meals and tracking. Training owns routine and workout entry points. Profile owns settings/account/goals/health entry points. This separation prevents screen bloat as the visual design becomes richer.

The tab bar follows the v2 system element direction: active health tint, muted inactive icons, compact labels, safe-area-aware height, and hidden native stack headers for tab screens because each screen owns its `ScreenHeader`.
