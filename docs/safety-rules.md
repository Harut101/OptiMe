# Safety Rules

Safety is backend-managed and deterministic. The mobile app must never set `safeMode` directly.

## Safe Mode Derivation

`safeMode` is derived from `Profile.dateOfBirth` by `SafetyService`.

Rules:

- Invalid birth date is rejected.
- Future birth date is rejected.
- Users under 18 are always `isMinor=true` and `safeMode=true`.
- Adults are `safeMode=false` unless future product logic adds another backend-only reason.

## Under-18 Behavior

Under-18 users receive safe wellness behavior.

Rules:

- No aggressive weight-loss targets.
- No strict calorie deficit guidance.
- No extreme macro rules.
- No body-image pressure.
- No shame-based language.
- Focus on balanced meals, hydration, sleep, recovery, healthy movement, and consistency.

If a minor submits a weight-loss goal, the backend converts it to `HEALTHY_LIFESTYLE` and removes target weight, timeline, and impact mode.

## Weight-Loss Goal Safety

Adult weight-loss goals are allowed only when they stay within deterministic safety boundaries.

Current boundaries:

- Maximum total loss: 25% of current body weight.
- Maximum pace: 1 kg per week.

Examples:

- `90kg -> 80kg in 60 days`: rejected as too aggressive.
- `90kg -> 85kg in 60 days`: allowed.

Rejected goals return supportive language, not shame or fear.

## Allergy And Excluded Food Blocking

Nutrition preferences are validated before save:

- Preferred foods cannot duplicate allergies.
- Preferred foods cannot duplicate excluded foods.

Daily plan output is also checked after provider generation:

- Generated food names are compared with allergies and excluded foods.
- If a conflict is found, the plan is replaced with the safe fallback plan.

Before safety checks, the backend normalizes safe avoidance qualifiers out of `foods[].name` because food names are structured fields, not prose. For example:

- `Mixed salad (no avocado, no broccoli)` becomes `Mixed salad` with notes `Prepared without avocado and broccoli.`
- `Salad without avocado` becomes `Salad` with notes `Prepared without avocado.`
- `No-avocado salad` becomes `Salad` with notes `Prepared without avocado.`
- `Avocado-free salad` becomes `Salad` with notes `Prepared without avocado.`

Only safe avoidance qualifiers are normalized. Actual restricted food dishes are not normalized and still fail safety:

- `Avocado toast`
- `Chicken with avocado`
- `Salad with avocado`
- `Pork rice bowl`

Actual food conflicts are blocked when restricted foods appear in:

- `nutrition.meals[].foods[].name`
- `nutrition.meals[].foods[].notes` when the note recommends eating, adding, serving, or including the food
- `reminders[]` when the reminder recommends eating, adding, serving, or including the food

Food names are strict hard checks. For notes and reminders, `SafetyService` evaluates the local phrase around the restricted food instead of the whole sentence. This prevents a safe avoidance clause from being rejected just because another part of the sentence uses a word like `add` or `choose`.

Safe avoidance mentions are allowed:

- `Avoid avocado`
- `This plan avoids avocado`
- `Avoiding avocado`
- `Without avocado`
- `No avocado`
- `Avocado-free option`
- `Avoid your allergy: avocado`
- `Add variety and fiber, avoiding avocado`
- `Choose vegetables, avoiding avocado`
- `This meal avoids your allergy: avocado`
- `Avoid pork and use chicken instead`

These do not count as including the restricted food.

Actual inclusion phrases are blocked:

- `Avocado toast`
- `Chicken with avocado`
- `Pork rice bowl`
- `Add avocado`
- `Add sliced avocado`
- `Serve with avocado`
- `Top with avocado`
- `Include avocado`
- `Use avocado as a side`
- `Pair with avocado`
- `Mix in avocado`
- `Salad with avocado`

Safety diagnostics include:

- `conflictType`: `allergy` or `excludedFood`
- `restrictedFood`
- `matchedFoodName`
- `matchedPath`

Example log:

```text
SafetyService failed: allergy conflict at nutrition.meals[1].foods[0].name; restrictedFood=avocado; matchedFoodName=Avocado toast
```

## Training Boundaries

Training schedule items are validated before save.

Maximum duration by intensity:

- `LOW`: 240 minutes.
- `MODERATE`: 180 minutes.
- `HIGH`: 120 minutes.

High-intensity training is rejected if the description mentions:

- pain
- injury
- sickness or illness
- fever
- dizziness
- exhaustion
- fainting
- chest pain

The backend response tells the user to choose rest or light movement instead of high intensity.

## Fallback Plan Behavior

Fallback is used when provider output fails validation or violates safety checks.

Fallback plan rules:

- Same `DailyPlanJson` schema.
- `status = FALLBACK`.
- `safety.adjustedForSafety = true`.
- Supportive, practical copy.
- No aggressive calorie targets.
- No extreme dieting language.
- No unsafe training advice.
- No medical diagnosis.

## Safety Boundary

Safety must run after provider output.

Future AI providers must not bypass:

- `dailyPlanJsonSchema`
- `SafetyService`
- fallback plan generation

## AI Safety Agent Boundary

Sprint 3 introduces a separate Safety Agent boundary for future semantic review. It is disabled by default in Batch 4.1 and uses a mock provider only.

The Safety Agent may later review tone, unsafe implications, medical-diagnosis language, body-shaming language, and semantic conflicts with `safeMode`. It must not replace deterministic hard rules for allergies, excluded foods, minors, dangerous goals, schema validation, or training boundaries.
