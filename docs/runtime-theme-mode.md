# Runtime Theme Mode

OptiMe stores each signed-in user's theme preference in `UserSettings`.

## Preferences

- `SYSTEM` is the default and follows the operating-system appearance.
- `LIGHT` always uses the light palette.
- `DARK` always uses the dark palette.

The mobile app resolves the active palette through `ThemeProvider`. The preference is loaded with the existing locale and measurement settings, so it follows the user across signed-in devices.

## Delivery boundary

The Settings sheet in Profile exposes System, Light, and Dark controls. The app shell, navigation, shared primitives, and primary Today, Food, and Profile surfaces resolve their colors through runtime semantic tokens.

Feature-specific screens will continue moving away from legacy static light-token styles in follow-up UI work. The preference remains safe to use now because every shared surface falls back to the active semantic palette.
