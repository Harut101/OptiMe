import { GoalType, IntensityLevel } from '@prisma/client';

export const MINOR_AGE = 18;

export const UNSAFE_TRAINING_DESCRIPTION_PATTERNS = [
  /\bpain\b/i,
  /\binjur(?:y|ed)\b/i,
  /\bsick\b/i,
  /\bill(?:ness)?\b/i,
  /\bfever\b/i,
  /\bdizz(?:y|iness)\b/i,
  /\bexhaust(?:ed|ion)\b/i,
  /\bfaint\b/i,
  /\bchest pain\b/i
];

export const SUPPORTIVE_SAFETY_MESSAGES = {
  invalidDateOfBirth: 'dateOfBirth must be a valid date.',
  futureDateOfBirth: 'dateOfBirth must be in the past.',
  missingProfileForGoal: 'Please complete your profile before setting a weight goal.',
  adultExtremeWeightGoal:
    "Let's choose a steadier goal that supports energy, training, and recovery.",
  pregnancyWeightGoal:
    "Let's keep this goal focused on steady energy, recovery, hydration, and balanced habits. For pregnancy, postpartum, or breastfeeding-specific changes, check with a healthcare provider.",
  unsafeTrainingIntensity:
    "Let's keep this session safer by lowering the intensity or shortening the duration.",
  pregnancyPlanUnsafe:
    'The generated plan included guidance that is not conservative enough for pregnancy, postpartum, or breastfeeding context.',
  unsafeTrainingDescription:
    'If you feel pain, illness, dizziness, or exhaustion, choose rest or light movement instead of high intensity.',
  foodPreferenceConflict:
    'Preferred foods cannot include allergies or foods you asked us to exclude.',
  planFoodConflict:
    'The generated plan included a food that conflicts with your allergies or excluded foods.',
  planExerciseUnsafe:
    'The generated plan included exercise guidance that needs to be made safer.'
} as const;

export const MINOR_SAFE_GOAL_TYPE = GoalType.HEALTHY_LIFESTYLE;

export const TRAINING_DURATION_LIMITS_BY_INTENSITY: Record<IntensityLevel, number> = {
  [IntensityLevel.LOW]: 240,
  [IntensityLevel.MODERATE]: 180,
  [IntensityLevel.HIGH]: 120
};

export const MAX_SAFE_WEIGHT_LOSS_FRACTION = 0.25;
export const MAX_SAFE_WEIGHT_LOSS_KG_PER_WEEK = 1;
