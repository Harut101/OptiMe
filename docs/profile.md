# Profile

Profile stores the current personal context used for future planning.

## Current Weight

`Profile.weightKg` remains the current-weight field used by Nutrition Targets. Manual weight tracking writes a `WeightLog` entry and updates `Profile.weightKg` so future previews and generated plans use the latest value.

Historical `DailyPlan.planJson` snapshots are not mutated after profile updates.

## Safety Context

The backend owns `safeMode` and derives age-aware safety from date of birth. Pregnancy, postpartum, and breastfeeding context remain optional but safety-relevant. Weight progress UI must stay neutral in `LIMITED` contexts and must not encourage aggressive change.

## Mobile Profile

Profile shows:

- personal profile details
- goal and mode entry point
- Weight Progress and recent weight history
- completed workout history entry point
- wellness safety, health connections, and settings

Weight updates can also be started from Today, but Profile owns history and fuller management.
