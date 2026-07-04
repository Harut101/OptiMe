# Food Mobile UI

The Food tab presents nutrition target, structured meal plan, food progress, meal cards, and preference editing with shared screen headers, section headers, and status pills.

Meal Details uses the same hierarchy for meal actions, nutrition, ingredients, preparation, substitutions, and meal rationale.

Food tracking behavior is unchanged: meal status updates remain plan-scoped and supportive, with no custom calorie logging or guilt-based language.

## Today nutrition progress

The Today dashboard shows nutrition progress from existing meal-completion data:

- `EATEN` meals count as complete.
- `PARTIALLY_EATEN` meals count as half progress.
- `SKIPPED` and `PLANNED` meals do not add progress.

This is a visual summary only. It does not create calorie logging, change Nutrition Engine targets, or rewrite the saved food plan.

## Food Screen Boundary

The Food tab is the primary nutrition working surface. It owns nutrition target context, food progress, meal cards, meal status actions, menu regeneration, and preference editing.

Meal cards should stay compact. Full ingredients, prep steps, substitutions, and meal-specific actions belong in Meal Details. Missing media should fail quietly instead of adding noisy placeholder text to every meal card.

Today may summarize food progress, but it should not duplicate the Food tab's nutrition target summary or detailed meal tracking blocks.
