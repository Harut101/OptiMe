# Food Preferences Mobile QA

## Scope

This checklist covers food preference refinement and meal/menu regeneration controls.

## Setup

- Use a user with completed onboarding and a generated Daily Plan that includes `nutrition.foodPlan`.
- Confirm the Food tab shows meal cards and Meal Details opens for each structured meal.

## Food Preferences

- Open Food tab and edit preferences.
- Add excluded foods, disliked foods, preferred foods, meal count, diet type, and notes.
- Save and confirm the saved-state message appears.
- Confirm changing preferences does not automatically regenerate the current Daily Plan.
- Cancel dirty edits and confirm the persisted values are restored.

## Full Menu Regeneration

- On Food tab, tap `Regenerate menu`.
- Confirm the dialog explains that nutrition target stays the same and training/recovery/reminders do not change.
- Confirm success updates the visible meal plan.
- Confirm failed regeneration keeps the existing menu visible and shows a friendly error.

## Meal Regeneration

- Open Meal Details.
- Tap `Regenerate meal`.
- Confirm the dialog offers `Keep current meal`.
- Confirm success updates the current meal and returns to a stable Food tab state.
- Confirm failed regeneration keeps the old meal visible and shows a friendly error.

## Exclude Ingredient

- From Meal Details, tap `Exclude ingredient` for one ingredient.
- Confirm the dialog explains the ingredient applies to future meals and does not change previous plans automatically.
- Confirm the ingredient appears in excluded foods after saving.
- Repeat the action and confirm no duplicate excluded-food row appears.

## Compatibility

- Open an old text-only plan without `nutrition.foodPlan`.
- Confirm regeneration actions are unavailable or return a safe unsupported message.
- Confirm substitutions remain display-only.

## Accessibility

- Confirm menu and meal regeneration actions have button labels.
- Confirm ingredient exclusion labels include the ingredient name.
- Confirm loading, success, and error states are visible without relying on color alone.
