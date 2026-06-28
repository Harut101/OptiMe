# Food preferences

Food preferences are owned by `/v1/nutrition-preferences`, not the general profile resource.

`FoodPreferencesForm` is a controlled, route-free component shared by onboarding and the Food tab. Page wrappers own API calls, navigation, validation presentation, and success/error states. Allergy confirmation remains safety-critical in onboarding and before a standalone save.

The Food tab supports loading, retry, empty setup, edit, save, cancel, dirty-state protection, and save confirmation. A missing preference record does not block the app; safe defaults continue to apply and the user can complete setup without restarting onboarding.

Saving updates future planning context only. It does not regenerate the visible plan, mutate historical plans, or delete plan data.

Draft behavior matches Training, Personal, and Goals: a real change enables Save, reverting clears dirty state, Cancel restores the persisted baseline, duplicate saves are disabled, and guarded back navigation confirms before discarding.

## Excluded, disliked, and preferred foods

- Allergies are safety constraints and must not be treated as preferences.
- Excluded foods are hard user constraints for future generated meals.
- Disliked foods are strong avoid preferences. The Nutrition Agent receives them separately from allergies and exclusions so it can avoid them without misclassifying them as medical safety data.
- Preferred foods are positive guidance only and should be used when they fit safely.

`PATCH /v1/food-preferences` is an authenticated convenience endpoint for standalone Food-tab editing. It uses the same persistence model as `/v1/nutrition-preferences` and does not regenerate an existing Daily Plan automatically.

## Ingredient exclusion

Meal Details can add a selected ingredient to excluded foods through `POST /v1/daily-plans/:id/food/exclude-ingredient`.

This does not mutate the current meal or previous plans. It only updates the user's excluded-food preferences, so future food-plan generation can avoid the ingredient. Duplicate exclusions are ignored safely.
## Localization

Food empty/loading/error states, allergy confirmation, diet labels, editable fields, and save feedback are localized. Diet enum identities and user-entered food names are stored and submitted unchanged.
