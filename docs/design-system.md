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
