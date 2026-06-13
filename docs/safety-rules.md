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

## Gender, Pregnancy, Postpartum, And Breastfeeding Safety

`Profile.gender` is optional and may be used as one careful personalization input. It must not be used to stereotype the user.

Rules:

- Do not assume pregnancy, postpartum, or breastfeeding status from gender alone.
- Do not say women should avoid strength training.
- Do not say women should eat very little.
- Do not say men should always bulk or lift heavy.
- Base recommendations on goal, ability, schedule, preferences, feedback, and safety context.

`Profile.pregnancyStatus` is optional and privacy-sensitive.

Current statuses:

- `NOT_PREGNANT`
- `PREGNANT`
- `POSTPARTUM`
- `BREASTFEEDING`
- `PREFER_NOT_TO_SAY`
- `UNKNOWN`

Only these statuses trigger pregnancy-sensitive safety behavior:

- `PREGNANT`
- `POSTPARTUM`
- `BREASTFEEDING`

For pregnancy-sensitive statuses, all tiers receive conservative safety behavior:

- Aggressive weight-loss goals are converted to `HEALTHY_LIFESTYLE`.
- Extreme calorie restriction language is rejected.
- Unsafe high-intensity training advice is rejected.
- Training through pain, dizziness, illness, injury, or exhaustion is rejected.
- Guidance should be balanced, hydration-aware, recovery-aware, and non-diagnostic.
- The app should encourage consulting a healthcare provider for personal pregnancy, postpartum, or breastfeeding guidance.

The app must not provide medical diagnosis. Pregnancy, postpartum, and breastfeeding safety is not paywalled.

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

## Exercise Recommendation Safety

Sprint 6 Batch 4 adds optional text-based `training.exercises` safety checks after provider generation.

`SafetyService` rejects exercise guidance that tells the user to:

- push through pain, injury, dizziness, illness, fever, exhaustion, fatigue, or discomfort
- train through symptoms
- ignore a reported limitation or pain area

When context is safety-sensitive, `SafetyService` also rejects max-effort or failure language:

- beginner training level
- under-18 or `safeMode`
- pregnancy, postpartum, or breastfeeding context
- reported pain or discomfort
- saved limitations or pain areas
- high tiredness

Examples rejected in sensitive contexts:

- `Use max effort`
- `Train to failure`
- `All-out effort`
- `1RM`
- `No pain no gain`

Exercise safety diagnostics include:

- `matchedPath`, such as `training.exercises[0].safetyNotes`
- `reason`, such as `training_through_symptoms`
- a short safe text snippet

The backend does not diagnose pain or injury. It only blocks unsafe exercise wording and falls back to safer guidance.

## Fallback Plan Behavior

Fallback is used when provider output fails validation or violates safety checks.

Fallback plan rules:

- Same `DailyPlanJson` schema.
- `status = FALLBACK`.
- `safety.adjustedForSafety = true`.
- `safety.userSafeMessage` should contain a user-facing explanation when possible.
- Supportive, practical copy.
- No aggressive calorie targets.
- No extreme dieting language.
- No unsafe training advice.
- No medical diagnosis.

The UI must not show raw `debug.fallbackReason`, provider errors, Safety Agent reason codes, or raw JSON. Those fields are for development diagnostics and operational monitoring only.

User-facing fallback copy should be short, calm, and specific enough to be useful:

- Aggressive weight-loss goal: choose a steadier goal that supports energy, training, and recovery.
- Under-18 weight-loss context: focus on balanced meals, hydration, sleep, recovery, healthy movement, and consistency.
- Pregnancy, postpartum, or breastfeeding context: keep guidance gentle, balanced, and conservative.
- Pain, dizziness, illness, exhaustion, or injury context: reduce intensity and prioritize conservative movement or rest.
- Allergy or excluded-food conflict: switch to a safer plan that avoids restricted foods.
- Invalid or unsafe provider output: use a reliable safe fallback because the generated plan could not be fully verified.
- Safety Agent rejection: use a safer fallback because the generated plan needed a more conservative safety review.

## Safety Boundary

Safety must run after provider output.

Future AI providers must not bypass:

- `dailyPlanJsonSchema`
- `SafetyService`
- fallback plan generation

## AI Safety Agent Boundary

Sprint 3 adds a separate Safety Agent boundary for semantic review after deterministic safety passes.

The Safety Agent can review:

- unsafe implications
- medical-diagnosis language
- body-shaming or guilt language
- gender-stereotyped recommendations
- unsafe pregnancy, postpartum, or breastfeeding recommendations
- unsafe diet or training advice
- unsafe exercise recommendations and progression
- semantic conflicts with `safeMode`
- tone that is not supportive or health-focused

It must not replace deterministic hard rules for allergies, excluded foods, minors, dangerous goals, schema validation, or training boundaries.

The Safety Agent is disabled by default:

```env
SAFETY_AGENT_ENABLED=false
SAFETY_AGENT_PROVIDER=mock
```

When enabled with OpenAI, it runs after `SafetyService`. If it rejects an OpenAI-generated plan with actionable `requiredChanges`, the backend may retry OpenAI generation once with concise safety feedback. Deterministic safety failures skip the Safety Agent and fallback immediately.
