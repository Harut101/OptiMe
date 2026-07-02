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
