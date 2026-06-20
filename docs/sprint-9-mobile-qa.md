# Sprint 9 Mobile QA

Run this checklist on a physical iPhone for each of `en-US`, `ru-RU`, `fr-FR`, and `zh-CN`.

- Switch language in Profile > Settings and confirm tabs and the visible screen update immediately.
- Restart Expo/dev build and confirm language and measurement system persist.
- Confirm tab labels and Profile's four section controls fit without clipping.
- Complete authentication and Stage 1 onboarding; verify drafts survive language changes.
- Open Food and Training editors, scroll with the keyboard open, and confirm Save/Cancel remain reachable.
- Check long French and Russian labels wrap in buttons, chips, cards, forms, and dialogs.
- Confirm Simplified Chinese renders naturally without broken glyphs or forced spaces.
- Toggle metric/imperial; verify kg/lb and cm/ft-in display while saved profile values remain stable.
- Use Body Map front/back and verify PNG/SVG alignment, exact muscle selection, bilateral behavior, calves on back view, and red `#FF2D55` overlays.
- Generate/open a plan and confirm only the UI shell changes language; stored generated text remains unchanged.
- Submit meal/training check-ins and feedback; verify stable payload behavior.
- Open Health Connections and confirm Connect, Sync, Disconnect, and delete actions remain reachable; Expo Go shows the localized unsupported message where appropriate.
- Confirm language or unit changes do not regenerate the current plan.

Physical-device QA must be recorded as pending unless these steps are actually performed on hardware.
