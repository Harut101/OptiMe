# Sprint 8B physical-device QA

Start Metro with a clean cache:

```powershell
pnpm --filter @optime/mobile start -- --clear
```

## Navigation

- Confirm Today, Food, Training, and Profile are visible with unclipped labels and icons.
- Confirm the tab bar respects the iPhone safe area and home indicator.
- Switch between tabs and confirm unfinished drafts remain available.
- Confirm no obsolete Settings bottom tab appears.

## Food

- Verify loading, saved preferences, and the empty setup state.
- Enter edit mode, change a field, cancel, and confirm the saved value returns.
- Save and confirm the future-plans message appears.
- Confirm the keyboard does not cover fields or make Save/Cancel unreachable.
- Navigate back with a dirty draft and confirm the discard prompt appears.

## Training

- Confirm the full Body Map fits inside the unchanged 4:5 card and the screen remains scrollable.
- Check exact selection for BICEPS, ABS, QUADRICEPS, GLUTES, and CALVES.
- Confirm selected overlays remain `#FF2D55` and aligned with the PNG.
- Verify Save remains reachable below the map and the keyboard does not break limitations input.
- Cancel an edit and confirm persisted muscles/equipment return.

## Profile and goals

- Open Personal, Health, Connections, and Settings; confirm labels are not clipped.
- Edit weight, height, activity level, gender, and pregnancy status where relevant.
- Open Goals, edit and cancel once, then edit and save; confirm the future-plans message.
- Confirm Connections still opens the existing health manager and its actions remain usable.
- Confirm Settings clearly marks unsupported controls instead of presenting fake persistence.

Physical-device QA has not been performed by Codex. Safe-area, keyboard, home-indicator, and native health behavior require manual iPhone verification.
