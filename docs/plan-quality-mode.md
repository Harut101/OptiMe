# Plan Quality Mode

Sprint 4 Batch 2 introduces `PlanQualityMode` as the backend-resolved personalization depth for daily plan generation.

## Mapping

| SubscriptionPlan | PlanQualityMode | Product Meaning |
|---|---|---|
| `FREE` | `BASIC` | Useful and safe |
| `PLUS` | `PERSONALIZED` | Understands habits |
| `PRO` | `ADAPTIVE` | Built specifically for today |

The backend resolves this through `EntitlementsService` and `FeatureAccessService`. The mobile client must not choose or override it.

## Safety Is Equal Across Tiers

Pricing affects personalization depth and usage limits, not safety.

All tiers keep:

- `DailyPlanJson` schema validation.
- Deterministic `SafetyService`.
- Safe fallback plans.
- Allergy checks.
- Excluded food checks.
- Under-18 safety.
- Dangerous goal protection.
- AI Safety Agent review when enabled or needed for safety.
- Pregnancy, postpartum, and breastfeeding safety adjustments.

Free users must never receive less-safe recommendations.

Gender/sex context may influence personalization carefully, but it must not create stereotypes. Pregnancy, postpartum, and breastfeeding context is optional, privacy-sensitive, and handled conservatively across all tiers.

## BASIC

`BASIC` is used for `FREE`.

Behavior:

- Safe daily plan.
- Simple meal guidance.
- One good, safe menu option.
- Simple training guidance.
- Simple protocol selection.
- Simple text exercise suggestions when appropriate.
- General safe gender-aware and pregnancy-aware guidance when explicitly provided.
- Limited context.
- Minimal personalization.

OpenAI prompt direction:

- Keep the plan simple, practical, and safe.
- Use limited context.
- Avoid advanced progression.
- Provide short exercise suggestions only when appropriate.

## PERSONALIZED

`PERSONALIZED` is used for `PLUS`.

Behavior:

- More detailed meals.
- Two practical menu options.
- Better use of preferred and excluded foods.
- Training adjusted to schedule and goal.
- Target muscle groups when available.
- Equipment-aware exercise recommendations when available.
- Training level awareness when available.
- Sets, reps, and rest guidance when safe.
- More personalized adjustments using gender, pregnancyStatus, preferences, feedback, and schedule when safe and explicitly provided.
- Better exercise suggestions from current schedule and description.
- Recent feedback/history summaries can influence the plan.

OpenAI prompt direction:

- Use preferences, schedule, goal, and feedback/history summaries more strongly.
- Include sets, reps, and rest only when appropriate and safe.
- Make the user feel the plan understands their habits.

## ADAPTIVE

`ADAPTIVE` is used for `PRO`.

Behavior:

- Highly individualized plan.
- Three individualized menu options.
- Deeper history and feedback awareness.
- Meal timing around workouts.
- Training adapted to goal, schedule, feedback, and readiness placeholders.
- Deeper check-in and history use.
- Recovery-aware push, maintain, or recover choices.
- Deeper personalization using gender, pregnancyStatus, history, feedback, and readiness placeholders when safe and explicitly provided.
- Future WHOOP recovery, sleep, and strain hooks.

OpenAI prompt direction:

- Use deeper context without inventing unavailable data.
- Use readiness placeholders for future recovery signals.
- Make recommendations feel specific to today.

## Sprint 6 Training And Protocol Implications

Sprint 6 introduced optional training preferences, deterministic protocol selection, and optional text-based exercise recommendations.

Important rules:

- Training preferences must not block first plan generation.
- `limitationsOrPainAreas` is safety-sensitive and should be prioritized in progressive prompts.
- Protocols should stay simple: IDs, rules, and safetyRules.
- AI should customize selected protocols, not invent the full plan from scratch.
- Exercise recommendations should be text-only.
- ExerciseLibrary and exercise media remain deferred.

Current available training context:

- Goal.
- Training schedule.
- Training description.
- Intensity.
- Duration.
- Feedback/history summary when tier allows it.
- Safety constraints.

Sprint 6 training preference inputs:

- Target body areas or muscle groups.
- Training outcome: strength, muscle growth, endurance, mobility, general fitness.
- Equipment: gym, home, dumbbells, bodyweight, machines.
- Training level: beginner, intermediate, advanced.
- Limitations or pain areas.

Future `ExerciseLibrary` may support:

- curated exercise names
- muscle groups
- equipment
- difficulty
- contraindications
- instructions
- future images/videos

For now, OpenAI can suggest exercises from current schedule/description, but must not create unsafe progression plans.

Sprint 6 passes selected training, nutrition, and recovery protocols into `AiProvider`.

Plan Details can render optional `training.exercises` when present. Today stays clean and does not render exercises.

## Nutrition Menu Options By Tier

Sprint 4 Batch 2.1 adds optional `nutrition.menuOptions` while keeping `nutrition.meals` as the primary menu used by existing mobile screens.

`BASIC`:

- One good, safe, useful menu.
- Simple and practical.
- Minimal personalization.

`PERSONALIZED`:

- Two useful menu options.
- Example focuses: `Balanced standard day`, `Quick/simple prep`.
- Better use of preferred foods, excluded foods, goal, and schedule.

`ADAPTIVE`:

- Three highly personalized menu options.
- Example focuses: `Workout support`, `Recovery friendly`, `Busy day/simple prep`.
- Stronger meal timing around workouts.
- Can use feedback/history summaries when available.
- May include future readiness/WHOOP placeholders in provider context, but must not invent WHOOP data.

All tiers:

- Must respect allergies and excluded foods.
- Must keep `foods[].name` clean.
- Must put preparation or exclusion notes in `notes`.
- Must not reduce safety for Free users.

Future mobile can add menu option switching. Batch 2.1 does not change mobile UI.

## Unsafe Training Handling

All modes must avoid:

- training through pain
- training through dizziness
- training through illness or fever
- training through exhaustion
- training through injury
- medical diagnosis

If these signals appear, all tiers should reduce intensity and prefer rest, mobility, or light movement.

## Sprint 6 Out Of Scope

- No payment integration.
- No ExerciseLibrary.
- No exercise images/videos.
- No advanced progression engine.
- No WHOOP.
- No AI Coach chat.
- No embeddings.
- No admin or web.
