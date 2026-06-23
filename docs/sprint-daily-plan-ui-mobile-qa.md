# Daily Plan UI physical-device QA

Physical-device QA is pending until this checklist is executed on an actual build. Do not mark an item complete from simulator or static validation alone.

## iPhone and Android

- Confirm Food and Training labels fit in English, Russian, French, and Simplified Chinese.
- Confirm selected tab state is obvious and announced by VoiceOver/TalkBack.
- Confirm Dynamic Type and long Russian/French exercise names wrap without clipping.
- Confirm recovery and reminders appear once below the tab content.
- Confirm library cards show a stable icon when the current zero-media catalog returns no thumbnail.
- Confirm thumbnails use contain behavior and never distort when approved media is registered.
- Confirm old free-text cards remain readable and do not open a broken details route.
- Confirm the full-screen details route opens, scrolls, and returns to the Training view.
- Confirm the portrait 4:5 frame fits the safe area and keeps the full anatomy image/equipment visible.
- Confirm zero-media fallback is polished, one image has no dots, and multiple images swipe horizontally with synchronized dots.
- Confirm horizontal paging does not prevent normal vertical scrolling outside the frame.
- Confirm image/network failure leaves instructions, prescription, cues, and safety notes visible.
- Confirm app restart reloads the plan, locale switching works, and no tab/card/media action regenerates the plan.

## Regression

- Confirm meal and training check-ins still save.
- Confirm feedback selection survives Food/Training switching.
- Confirm Today, Food preferences, Training preferences, Profile, Goals, and Body Map remain unchanged.
