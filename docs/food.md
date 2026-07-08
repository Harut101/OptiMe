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
## Pricing And Entitlements

Food remains valuable in both app modes. Nutrition-only users can use Free, Plus, or Pro because paid value is not tied to Training being enabled.

Meal and menu regeneration now use backend usage limits:

- `MENU_REGENERATION` for full menu replacement.
- `MEAL_REGENERATION` for a single meal replacement.

If a limit is reached, Food and Meal Details show localized contextual upgrade placeholder copy, keep the existing plan visible, and do not mutate `DailyPlan`.
# Food Visual Design v2

Food is a premium meal dashboard, not a form-heavy preferences page. The main Food surface should prioritize today's structured food plan, meal progress, compact meal cards, and contextual regeneration actions.

Meal cards should show meal type, title, kcal/protein, prep context, status, and a detail affordance. Status actions should stay compact and must not hide the existing tracking behavior.

Food preferences remain editable from Food, but preference editing should feel secondary to today's meal plan.

## Food + Meal Cards Redesign

The Food screen now uses the same Apple Health-inspired dashboard language as Today:

- `NutritionTargetSummaryCard` shows a large calorie target, compact macro metrics, status, and a bottom-sheet explanation for why the target was chosen.
- `MealProgressWidget` summarizes meal completion without shame-based wording.
- `PremiumMealCard` keeps each meal compact with meal type, title, kcal/protein, prep time, status, and a detail affordance.
- Meal status changes use compact chips. Additional meal actions open a focused sheet instead of large button rows.

Meal Details now opens with a focused hero summary, large kcal value, compact macro widgets, status controls, ingredients, preparation, substitutions, and meal rationale. Regenerate and ingredient-exclusion confirmations use the shared feedback sheet rather than raw alerts.

Unified feedback rules for Food:

- Small success states use `AppToast`.
- Regenerate meal/menu confirmations use `AppFeedbackSheet`.
- Current-plan impact from preference changes uses `PlanImpactPromptCard`.
- Limit/usage failures stay contextual and keep the current meal plan visible.
- Safety-sensitive food changes must not be hidden behind a generic toast.
