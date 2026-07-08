# Design System Preview

The internal Design System Preview route lives at:

```txt
/design-system-preview
```

In development, Profile > Settings shows a link to the preview. It is not a primary production tab.

The preview currently shows:

- Color tokens
- Typography variants
- Buttons
- Chips
- Cards
- Progress bar
- Empty state
- Error state
- AppIcon registry examples

The preview is a working surface for checking the UI foundation while OptiMe continues to migrate screens gradually.

## Core polish primitives

The production mobile screens use a lightweight polish layer in `apps/mobile/src/components`:

- `ScreenHeader`
- `SectionHeader`
- `StatusPill`
- `ContextNoteCard`
- `MetricCard`

These components are intentionally small. They standardize hierarchy, status labels, context notes, and health metrics without replacing the older `Card`, `Button`, `Text`, or `StateBlock` primitives.

## Visual Direction

The design system now uses typed semantic theme colors in `apps/mobile/src/theme/colors.ts`. The palette includes light and dark theme tokens plus nutrition, training, recovery, health, success, warning, danger, and info colors with muted variants.

The Design System Preview route shows light palette examples, dark palette examples, semantic color cards, status pills, metric cards, context notes, empty states, and error states.

Dark theme tokens are available for preview/future switching, but runtime theme selection is not implemented yet.

## Expo Go Color Tuning

Expo Go physical QA showed the first semantic palette was a little too pale. The current palette keeps the Apple Health-inspired direction but uses stronger accents, clearer muted fills, bordered status pills, and semantic `MetricCard` tones.

The Design System Preview should be used on device to compare:

- light semantic palette
- dark semantic palette
- selected chip states
- button states
- `StatusPill` semantic variants
- `MetricCard` semantic variants
- `ContextNoteCard` semantic accents

## Today Dashboard Components

The preview also includes Today dashboard primitives:

- `CircularProgressRing`
- `DashboardProgressCard`
- `WearableSummaryCard`

These components are used for presentation only. They consume existing food log, workout session, and wearable snapshot data without creating new planning formulas or backend state.

The current ring preview includes:

- nutrition electric ring;
- training electric ring;
- rest-day ring;
- 0% state;
- 100% state;
- dashboard progress card examples;
- wearable summary card example.

The ring implementation uses segmented SVG strokes to make the gradient visibly stronger in Expo Go while preserving accessibility labels and deterministic progress values.

## Visual Design v2 Components

The Design System Preview now includes the v2 mobile component language:

- `AIRecommendationEntry`
- `AICoachBottomSheet`
- `BottomSheet`
- `ProviderConnectionCard`
- `HealthMetricWidget`
- `MealCardV2`
- `WorkoutCardV2`
- `SettingsListItem`
- `MiniBarChart`
- tuned `MetricCard`
- tuned `Card`, `Button`, `Text`, `ScreenHeader`

These are presentation-only primitives. They do not change DailyPlan generation, food tracking, workout execution, Health sync, usage limits, or backend contracts.

`HealthMetricWidget` is the Apple Health-inspired metric style for wearable/health summaries: theme-aware compact card, semantic title/icon, small context line, large value, unit, and optional comparison/footer text. It adapts its surface, text, border, shadow, and accent colors from light/dark theme tokens instead of staying permanently black. It is intended for steps, sleep, active calories, workout minutes, heart-rate-style future metrics, and similar dashboard widgets.

The widget also supports optional mini bars, progress fill, press handling, and explicit accessibility labels. Use these lightweight visuals instead of adding a chart library for dashboard summaries. The main value should remain large and readable; color belongs on icons, labels, progress, and chart accents rather than filling the entire card.

Food dashboard primitives:

- `MacroMetricWidget` for protein, carbs, fat, and kcal values.
- `MealProgressWidget` for meal completion progress.
- `PremiumMealCard` for compact meal list items.
- `MealStatusControl` for compact planned/eaten/partial/skipped status changes.
- `AppToast` for non-blocking success/info feedback.
- `AppFeedbackSheet` for confirmation, limit, and important contextual feedback.

Use these primitives before adding one-off cards or raw React Native alerts. Status must remain text-based, not color-only.

Bottom sheets are used for concise detail expansion, especially AI Coach guidance. Main screens should avoid long explanatory blocks when a short entry point plus detail sheet is enough.

## System Element Refinement

The v2 system also standardizes small native-feeling controls:

- Bottom tabs use a compact iOS-style bar with strong active tint, muted inactive labels, safe-area padding, and no duplicate tab-stack header.
- `SelectChips` behaves like a lightweight segmented picker for single-choice controls.
- `MultiSelectChips` remains pill-based for multi-choice controls, with clearer active contrast and accessible checked state.
- `Field` inputs use rounded elevated surfaces, subtle borders, and comfortable 52pt minimum height.

These refinements are presentation-only and preserve existing form payloads, validation, routing, and API behavior.
