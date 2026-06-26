import { ActivityLevel, PrimaryGoal } from '@prisma/client';

export const NUTRITION_ENGINE_VERSION = 1;

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  LOW: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  HIGH: 1.725,
  ATHLETE: 1.9
};

export const GOAL_CALORIE_ADJUSTMENTS: Record<PrimaryGoal, number> = {
  WEIGHT_LOSS: -300,
  WEIGHT_MAINTENANCE: 0,
  WEIGHT_GAIN: 250,
  HEALTHY_EATING: 0
};

export const TRAINING_KCAL_PER_MINUTE = 4;
export const MAX_TRAINING_KCAL_ADJUSTMENT = 400;

export const ADULT_MIN_CALORIES = {
  female: 1400,
  male: 1500,
  default: 1400
};
