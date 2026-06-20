# Food preferences

Food preferences are owned by `/v1/nutrition-preferences`, not the general profile resource.

`FoodPreferencesForm` is a controlled, route-free component shared by onboarding and the Food tab. Page wrappers own API calls, navigation, validation presentation, and success/error states. Allergy confirmation remains safety-critical in onboarding and before a standalone save.

The Food tab supports loading, retry, empty setup, edit, save, cancel, dirty-state protection, and save confirmation. A missing preference record does not block the app; safe defaults continue to apply and the user can complete setup without restarting onboarding.

Saving updates future planning context only. It does not regenerate the visible plan, mutate historical plans, or delete plan data.

Draft behavior matches Training, Personal, and Goals: a real change enables Save, reverting clears dirty state, Cancel restores the persisted baseline, duplicate saves are disabled, and guarded back navigation confirms before discarding.
## Localization

Food empty/loading/error states, allergy confirmation, diet labels, editable fields, and save feedback are localized. Diet enum identities and user-entered food names are stored and submitted unchanged.
