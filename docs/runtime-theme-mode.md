# Runtime Theme Mode

OptiMe stores each signed-in user's theme preference in `UserSettings`.

## Preferences

- `SYSTEM` is the default and follows the operating-system appearance.
- `LIGHT` always uses the light palette.
- `DARK` always uses the dark palette.

The mobile app resolves the active palette through `ThemeProvider`. The preference is loaded with the existing locale and measurement settings, so it follows the user across signed-in devices.

## Delivery boundary

This first batch adds the persisted contract and runtime provider only. It deliberately does not expose a theme picker yet: shared mobile primitives and screens still contain static light-token styles. The next batch will migrate those surfaces to semantic runtime tokens, then expose the System, Light, and Dark controls in Settings.

This avoids presenting a partially themed interface to users.
