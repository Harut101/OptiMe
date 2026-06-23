# Daily Plan mobile UI

Plan Details presents `Food` and `Training` as local views of one persisted Daily Plan. Switching views never writes data, regenerates the plan, or calls an AI provider. The plan header, safety state, recovery, reminders, check-in result, and feedback remain shared outside the tab content.

Food keeps the existing meals, meal check-ins, and hydration rendering. Training shows the recommendation, training check-in, discomfort signal, and planned exercise cards. The initial view is Food when meals exist, Training only when meals are empty and exercises exist, and Food when both are empty. A newly generated plan resets this local choice; opening and closing Exercise Details preserves it while Plan Details remains mounted.

Library-backed cards use the immutable planned name and snapshot metadata plus the plan prescription. Live list data supplies only the optional primary thumbnail. Older free-text exercises remain text-only, make no library lookup, and do not open details.

Recovery and reminders are rendered once after the selected content. Feedback state stays in Plan Details and is not owned by either tab.
