# Mobile UI Foundation

This batch adds a small StyleSheet-based UI foundation for future OptiMe screens. The app continues to support existing components while new or updated screens can use the shared primitives.

Added foundations:

- Typed design tokens in `apps/mobile/src/ui/theme`
- `AppText`
- `UICard`
- `UIButton`
- `Chip`
- `EmptyState`
- `ErrorState`
- `ProgressBar`
- `AppIcon`

The foundation intentionally avoids Tailwind, NativeWind, Tamagui, and large UI kits. This keeps the mobile app lightweight and lets us evolve the visual language within React Native conventions.

Visual direction:

- Calm premium health coach
- Light background
- White cards
- Subtle borders
- Small, readable typography
- `#FF2D55` brand accent
- No aggressive fitness or body-transformation styling

Existing screens still contain some legacy raw colors. New UI should prefer the token files and avoid introducing new raw hex values outside theme definitions.
