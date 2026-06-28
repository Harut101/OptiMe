# Daily Plan mobile UI

Plan Details presents `Food` and `Training` as local views of one persisted Daily Plan. Switching views never writes data, regenerates the plan, or calls an AI provider. The plan header, safety state, recovery, reminders, check-in result, and feedback remain shared outside the tab content.

Food keeps the existing meals, meal check-ins, and hydration rendering. Training shows the recommendation, training check-in, discomfort signal, and planned exercise cards. The initial view is Food when meals exist, Training only when meals are empty and exercises exist, and Food when both are empty. A newly generated plan resets this local choice; opening and closing Exercise Details preserves it while Plan Details remains mounted.

Library-backed cards use the immutable planned name and snapshot metadata plus the plan prescription. Live list data supplies only the optional optimized primary thumbnail. Exercise Details fetches full media separately. Older free-text exercises remain text-only, make no library lookup, and do not open details.

Recovery and reminders are rendered once after the selected content. Feedback state stays in Plan Details and is not owned by either tab.
# Daily Plan UI

## Structured Food Plans

When `plan.nutrition.foodPlan` exists, mobile should prefer it for Food tab meal cards and Meal Details.

Food tab shows:

- nutrition target summary
- total kcal/macros
- meal cards
- fallback note when `source=DETERMINISTIC_FALLBACK`

Meal Details shows:

- meal title and type
- approximate nutrition
- serving summary
- ingredients
- preparation steps
- display-only substitutions
- reason-code explanation

Today remains focused and does not need to show full meal details.

Older plans without `nutrition.foodPlan` should continue to render legacy `nutrition.meals` where needed.

## Food refinement controls

Food tab can show a secondary `Regenerate menu` action when the current plan has a structured `nutrition.foodPlan`. The confirmation explains that the nutrition target stays fixed and that training, recovery, and reminders will not change.

Meal Details can show:

- `Regenerate meal`
- ingredient-level `Exclude ingredient`
- display-only substitutions

Failed regeneration keeps the current meal/menu visible. Excluding an ingredient updates future food preferences only and does not automatically rewrite the current plan. Old text-only plans hide regeneration actions by returning a safe unsupported state from the backend.
