# Nutrition Agent Mobile QA

Use this checklist after generating a new daily plan.

## Food Tab

- Food tab still shows the nutrition target summary card.
- If `nutrition.foodPlan` exists, Food tab shows a Meal plan card.
- The card shows total kcal, protein, carbs, and fat.
- The card shows each meal as a touchable card.
- Meal cards show meal type, title, kcal, protein, and prep time when available.
- Fallback food plans show a calm safety note.
- No meal completion or food logging UI appears on Food tab.

## Meal Details

- Tapping a meal opens Meal Details with `dailyPlanId` and `mealId`.
- Meal Details loads from the current plan data.
- Meal Details shows title, meal type, nutrition totals, serving, ingredients, preparation steps, substitutions, and reason-code explanations.
- Missing or old plans show a friendly unavailable state instead of crashing.
- No raw debug metadata, prompt text, OpenAI response, or validation internals appear.

## Localization

Verify static UI labels in:

- English
- Russian
- French
- Simplified Chinese

Agent-generated meal titles may be localized by the agent according to the requested locale.

## Accessibility

- Meal plan title is exposed as a heading.
- Meal cards have meaningful accessibility labels with meal type, title, calories, and protein.
- Ingredient and preparation sections have headings.
- Preparation steps are ordered.
- Safety/fallback notes are visible text, not color-only indicators.

