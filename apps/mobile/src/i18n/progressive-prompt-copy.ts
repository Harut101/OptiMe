import type { TFunction } from 'i18next';
import type { DietType, TargetMuscleGroup, TrainingEquipment, TrainingLevel, TrainingOutcome } from '@optime/shared-types';
import type { ProgressivePrompt } from '@/types/api';
import { getDietTypeLabel, getEquipmentLabel, getMuscleGroupLabel, getTrainingLevelLabel, getTrainingOutcomeLabel } from './enum-labels';

const COPY_KEYS: Record<string, { title: string; description: string }> = {
  EXCLUDED_FOODS: { title: 'progressive.excludedFoodsTitle', description: 'progressive.excludedFoodsDescription' },
  PREFERRED_FOODS: { title: 'progressive.preferredFoodsTitle', description: 'progressive.preferredFoodsDescription' },
  LIMITATIONS_OR_PAIN_AREAS: { title: 'progressive.limitationsTitle', description: 'progressive.limitationsDescription' },
  EQUIPMENT: { title: 'progressive.equipmentTitle', description: 'progressive.equipmentDescription' },
  TRAINING_LEVEL: { title: 'progressive.trainingLevelTitle', description: 'progressive.trainingLevelDescription' },
  TARGET_MUSCLE_GROUPS: { title: 'progressive.musclesTitle', description: 'progressive.musclesDescription' },
  COOKING_TIME: { title: 'progressive.cookingTimeTitle', description: 'progressive.cookingTimeDescription' },
  MEAL_PREP: { title: 'progressive.mealPrepTitle', description: 'progressive.mealPrepDescription' },
  MEAL_TIMING: { title: 'progressive.mealTimingTitle', description: 'progressive.mealTimingDescription' },
  DIET_TYPE: { title: 'progressive.dietTypeTitle', description: 'progressive.dietTypeDescription' },
  MEALS_PER_DAY: { title: 'progressive.mealsPerDayTitle', description: 'progressive.mealsPerDayDescription' },
  TRAINING_OUTCOME: { title: 'progressive.trainingOutcomeTitle', description: 'progressive.trainingOutcomeDescription' }
};

export function getProgressivePromptCopy(t: TFunction, prompt: ProgressivePrompt) {
  const keys = COPY_KEYS[prompt.key];
  return keys ? { title: t(keys.title as never), description: t(keys.description as never) } : { title: prompt.title, description: prompt.description };
}

export function getProgressiveOptionLabel(t: TFunction, promptKey: string, value: string, fallback: string) {
  if (promptKey === 'EQUIPMENT') return getEquipmentLabel(t, value as TrainingEquipment);
  if (promptKey === 'TRAINING_LEVEL') return getTrainingLevelLabel(t, value as TrainingLevel);
  if (promptKey === 'TARGET_MUSCLE_GROUPS') return getMuscleGroupLabel(t, value as TargetMuscleGroup);
  if (promptKey === 'DIET_TYPE') return getDietTypeLabel(t, value as DietType);
  if (promptKey === 'TRAINING_OUTCOME') return getTrainingOutcomeLabel(t, value as TrainingOutcome);
  const key = `progressive.options.${value}`;
  return t(key as never, { defaultValue: fallback });
}
