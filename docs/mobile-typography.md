# OptiMe Mobile Typography

OptiMe uses a system-first typography scale inspired by the supplied Apple
design reference, adapted for a mobile wellness product rather than copied as
an Apple visual theme.

## Font Resolution

- iOS: `System`, which resolves to San Francisco.
- Android: `sans-serif`.
- Web: `system-ui`.

No custom font download is required. This keeps the UI fast, native-feeling,
and legible in every supported locale.

## Scale

| Token | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `largeTitle` / `hero` | 40 / 44 | 600 | Primary screen statement |
| `title` | 34 / 38 | 600 | Screen title |
| `heading` | 24 / 29 | 600 | Section heading |
| `metric` | 36 / 40 | 600 | Important health value |
| `bodyStrong` | 17 / 22 | 600 | Emphasized body copy |
| `body` | 17 / 25 | 400 | Default reading copy |
| `label` | 14 / 18 | 600 | Controls and compact labels |
| `caption` | 14 / 20 | 400 | Secondary explanation |
| `button` | 17 / 20 | 600 | Primary and secondary actions |
| `finePrint` | 12 / 16 | 400 | Supporting legal or metadata copy |

Display text uses subtle negative tracking. Body copy is intentionally 17 px
with relaxed leading so plans, safety guidance, and localized descriptions are
comfortable to read rather than compressed.

## Rules

- Use weight 600 for hierarchy; avoid 800 and 900 as default emphasis.
- Do not uppercase normal labels just to create hierarchy.
- Use text color and semantic context, not heavier font weight, for status.
- Primary buttons are 48 px pill controls without decorative shadows.
- Status pills may wrap and must not clip or ellipsize meaningful localized text.
- Preserve OptiMe's existing semantic nutrition, training, recovery, health,
  success, warning, and danger colors. Typography changes do not replace the
  product's color system with Apple Action Blue.

## Adoption

Use `src/components/Text.tsx` for product screens and `src/ui/AppText.tsx`
for the smaller UI primitive layer. Both expose the same core hierarchy. New
screens should use a token variant before adding local font size or weight
overrides.
