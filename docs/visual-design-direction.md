# Visual Design Direction

OptiMe's visual direction is inspired by the calm readability of Apple Health without copying Apple Health layouts, icons, charts, exact colors, or wording.

## Product Feel

The mobile app should feel:

- premium
- calm
- clean
- modern
- supportive
- health-coach oriented
- iOS-friendly
- card-based
- low-noise

Avoid aggressive gym-app styling, admin-dashboard density, neon dark mode, harsh warning colors, body-shaming wording, and guilt-based food language.

## Theme Tokens

Production tokens live in `apps/mobile/src/theme/colors.ts`.

The typed `ThemeColors` contract includes:

- background and surface layers
- card and pressed states
- primary/secondary/muted/inverse text
- border and divider
- accent
- semantic nutrition, training, recovery, health, success, warning, danger, and info colors
- muted variants for each semantic color

`lightThemeColors` is the active production palette. `darkThemeColors` is defined and exported for future runtime theme switching and visual preview.

Backward-compatible aliases such as `colors.primary`, `colors.card`, `colors.ink`, and `colors.line` remain so older screens can migrate gradually.

## Light Theme

Light mode uses:

- soft off-white background
- white/elevated cards
- subtle dividers
- warm health accent
- strong but calm text contrast

The hierarchy is:

```txt
background -> surface -> elevated card -> semantic accent
```

## Dark Theme

Dark mode tokens are defined but not yet user-switchable. The palette avoids pure black and neon colors:

- deep green-black background
- elevated dark cards
- softened semantic accents
- readable text contrast
- muted borders and dividers

## Semantic Health Colors

Semantic color intent:

- nutrition: mint/green
- training: blue
- recovery: lavender
- health/wearable: soft red/pink
- success: soft green
- warning: amber
- danger: muted red for real errors only
- info: soft blue

Muted variants are for backgrounds and pills. Stronger variants are for text accents, icons, and selected states.

## Card System

Cards are the main OptiMe interface language. They should include:

- consistent radius
- calm padding
- clear section heading
- short supporting copy
- one primary action when needed
- readable status indicators
- light/dark-safe semantic colors

The shared card primitives are:

- `Card`
- `ScreenHeader`
- `SectionHeader`
- `StatusPill`
- `ContextNoteCard`
- `MetricCard`

## Accessibility

- Status is text-based, never color-only.
- Buttons keep localized labels.
- Context notes expose readable title/message labels.
- Touch targets remain comfortable.
- Warning and danger colors are reserved for actual caution/error states.

Apple Health physical QA remains manual and paused until the user tests with a MacBook + iPhone development build.
