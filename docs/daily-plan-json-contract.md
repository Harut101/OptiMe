# DailyPlanJson Contract

Daily plans are stored in `DailyPlan.planJson` and returned to mobile as normalized JSON. The current schema version is `sprint-2.v1`.

## API Response Shape

```ts
{
  id: string;
  planLocalDate: string;
  planTimezone: string;
  status: "READY" | "FALLBACK";
  readinessLevel: "PUSH" | "MAINTAIN" | "RECOVER";
  updatedAt: string;
  plan: DailyPlanJson;
}
```

## DailyPlanJson

```ts
type DailyPlanJson = {
  schemaVersion: "sprint-2.v1";
  generatedAt: string;
  mockVersion: number;
  safety: {
    safeMode: boolean;
    adjustedForSafety: boolean;
    reasons: string[];
  };
  summary: {
    title: string;
    message: string;
    readiness: "PUSH" | "MAINTAIN" | "RECOVER";
  };
  nutrition: {
    calorieGuidance: {
      label: string;
      notes: string;
    };
    macroGuidance: {
      protein: string;
      carbs: string;
      fat: string;
      notes: string;
    };
    meals: Array<{
      name: string;
      purpose: string;
        foods: Array<{
          name: string;
          portion: string;
          notes?: string;
      }>;
    }>;
    hydration: {
      guidance: string;
      notes?: string;
    };
  };
  training: {
    recommendation: string;
    intensity: "REST" | "LIGHT" | "MODERATE" | "HARD";
    notes: string;
  };
  recovery: {
    recommendation: string;
    sleepTip?: string;
    mobilityTip?: string;
  };
  reminders: string[];
};
```

## Food Name Contract

`nutrition.meals[].foods[].name` must be a clean food or dish name only.

Do not embed allergy, exclusion, or avoidance explanations in `foods[].name`.

Do not write:

- `Mixed salad (no avocado)`
- `Mixed salad (no avocado, no broccoli)`
- `No-avocado salad`
- `Avocado-free salad`
- `Salad without avocado`

Write this instead:

```json
{
  "name": "Mixed salad",
  "portion": "1 bowl",
  "notes": "Prepared without avocado."
}
```

Backend normalization can clean safe avoidance qualifiers before safety checks, but providers should still treat clean food names as the contract. Actual restricted foods in food names, such as `Avocado toast`, `Chicken with avocado`, or `Pork rice bowl`, remain safety failures.

Deterministic safety checks rely on structured fields. Future AI Safety Agent review can add semantic review, but hard rules for allergies and excluded foods stay backend-owned and deterministic.

## Example Normalized Plan

```json
{
  "schemaVersion": "sprint-2.v1",
  "generatedAt": "2026-06-02T10:00:00.000Z",
  "mockVersion": 2,
  "safety": {
    "safeMode": false,
    "adjustedForSafety": false,
    "reasons": []
  },
  "summary": {
    "title": "Steady plan for today",
    "message": "Today's plan supports steady energy, balanced meals, and manageable movement.",
    "readiness": "MAINTAIN"
  },
  "nutrition": {
    "calorieGuidance": {
      "label": "Steady energy target",
      "notes": "A balanced target for steady energy today."
    },
    "macroGuidance": {
      "protein": "Protein with each meal",
      "carbs": "Choose steady-energy carbs around activity",
      "fat": "Include satisfying fats in moderate portions",
      "notes": "Use this as practical direction, not a strict rule."
    },
    "meals": [
      {
        "name": "Breakfast",
        "purpose": "Start with something familiar, balanced, and easy to repeat.",
        "foods": [
          {
            "name": "Greek yogurt or a preferred protein option",
            "portion": "1 bowl",
            "notes": "Add fruit or oats if that feels good today."
          }
        ]
      }
    ],
    "hydration": {
      "guidance": "Sip regularly across the day, especially around training.",
      "notes": "Hydration supports energy and recovery."
    }
  },
  "training": {
    "recommendation": "Keep training controlled and sustainable today.",
    "intensity": "MODERATE",
    "notes": "Adjust effort down if energy, sleep, or recovery feels off."
  },
  "recovery": {
    "recommendation": "Support recovery with regular meals, hydration, and a calm evening routine.",
    "sleepTip": "Give yourself a realistic wind-down window tonight.",
    "mobilityTip": "Add gentle mobility if it feels good."
  },
  "reminders": ["Hydrate regularly", "Eat after training", "Keep your evening routine calm"]
}
```

## Example Fallback Plan

Fallback plans use the same schema and set:

```json
{
  "schemaVersion": "sprint-2.v1",
  "safety": {
    "safeMode": true,
    "adjustedForSafety": true,
    "reasons": ["The generated plan could not be safely validated."]
  }
}
```

The full fallback still includes `summary`, `nutrition`, `training`, `recovery`, and `reminders`.

## Backward Compatibility

Old Sprint 1 `planJson` is normalized on read by `daily-plan-normalizer.ts`.

Rules:

- Old rows are not rewritten automatically.
- Responses always return the normalized `sprint-2.v1` shape.
- Mobile should render only the normalized response shape.
- New generated plans are persisted in normalized form.

## Mobile Rendering Expectations

Mobile should read:

- `plan.summary.title`
- `plan.summary.message`
- `plan.nutrition.calorieGuidance`
- `plan.nutrition.macroGuidance`
- `plan.nutrition.meals`
- `plan.training`
- `plan.recovery`
- `plan.reminders`
- `plan.safety`

Mobile should show a simple safety note when response `status` is `FALLBACK` or `plan.safety.adjustedForSafety` is `true`.
