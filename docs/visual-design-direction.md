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

Semantic color intent after Expo Go color tuning:

- nutrition: vivid mint/green
- training: clear blue/indigo
- recovery: richer lavender/purple
- health/wearable: Apple Health-inspired pink/red
- success: clear green
- warning: amber
- danger: muted red for real errors only
- info: soft blue

Muted variants are for backgrounds and pills. Stronger variants are for text accents, icons, and selected states.

## Expo Go Color Tuning

Physical Expo Go QA showed that the first visual direction was correct but slightly too pale on a real phone screen. The follow-up tuning increased semantic color strength while preserving the calm card-based hierarchy.

- Health accent moved closer to `#FF2D55`.
- Nutrition, training, recovery, success, warning, danger, and info colors became clearer.
- Muted semantic fills became more visible but remain soft.
- Status pills include subtle borders for faster scanning.
- Metric cards can use semantic tones for clearer health and recovery highlights.
- Primary actions use the stronger health accent.

Cards remain mostly white/elevated in light mode; the app avoids saturated full-card backgrounds.

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

## Today Dashboard Visuals

The Today dashboard uses circular progress rings inside calm cards. Rings are semantic, not gamified:

- nutrition uses the nutrition palette;
- training uses the training palette;
- wearable metrics use compact `MetricCard` tiles.

The dashboard should stay lightweight and supportive. It must not introduce streak pressure, guilt copy, aggressive calorie language, or alarming wearable interpretations.

## Electric Progress Ring Tuning

Expo Go QA showed the first Today dashboard rings were functional but too pale. The tuned direction keeps the calm card system while making the active arc the visual highlight.

Nutrition ring colors:

```txt
#7EF7D4 -> #2FE6C3 -> #00D1A5 -> #B9FF6A
```

Training ring colors:

```txt
#6C7CFF -> #8B5CF6 -> #D000D9 -> #FF2D55
```

Rest-day rings use a quieter blue track/accent so rest looks intentional rather than failed:

```txt
track #E4ECFF, accent #B8CCFF -> #8FAEFF
```

The active arc uses rounded segmented strokes with a subtle end-cap dot for partial progress. The app should not use heavy glow, noisy shadows, or full-card neon backgrounds.
