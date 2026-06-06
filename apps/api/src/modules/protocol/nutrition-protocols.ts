import { NutritionProtocol, NutritionProtocolId } from './protocol.types';

export const nutritionProtocols: Record<NutritionProtocolId, NutritionProtocol> = {
  SAFE_WEIGHT_LOSS: {
    id: 'SAFE_WEIGHT_LOSS',
    title: 'Safe weight-loss nutrition',
    rules: [
      'Use balanced meals with protein, fiber, steady-energy carbohydrates, and satisfying fats.',
      'Prefer practical portions, hydration, and consistency over strict restriction.'
    ],
    safetyRules: [
      'Do not recommend starvation, skipped meals, detoxes, cleanses, or extreme calorie restriction.',
      'Do not use shame-based or body-pressure language.'
    ]
  },
  MUSCLE_GAIN: {
    id: 'MUSCLE_GAIN',
    title: 'Muscle-support nutrition',
    rules: [
      'Support training with regular protein-rich meals and enough carbohydrates for performance.',
      'Keep meals realistic and digestion-friendly around workouts.'
    ],
    safetyRules: [
      'Do not encourage unsafe bulking, force-feeding, or supplement dependency.',
      'Do not ignore allergies, excluded foods, or pregnancy/postpartum context.'
    ]
  },
  MAINTENANCE: {
    id: 'MAINTENANCE',
    title: 'Maintenance nutrition',
    rules: [
      'Support steady energy with balanced meals and practical portions.',
      'Emphasize consistency, hydration, and meal timing around planned activity.'
    ],
    safetyRules: [
      'Do not use aggressive calorie targets.',
      'Do not frame maintenance as failure or lack of progress.'
    ]
  },
  HEALTHY_LIFESTYLE: {
    id: 'HEALTHY_LIFESTYLE',
    title: 'Healthy lifestyle nutrition',
    rules: [
      'Prioritize balanced meals, hydration, fiber, and simple repeatable habits.',
      'Use preferred foods when safe and practical.'
    ],
    safetyRules: [
      'Do not use fear-based food language.',
      'Do not classify foods as morally good or bad.'
    ]
  },
  PREGNANCY_POSTPARTUM_SAFE: {
    id: 'PREGNANCY_POSTPARTUM_SAFE',
    title: 'Pregnancy/postpartum-safe nutrition',
    rules: [
      'Use balanced, hydration-aware, recovery-aware meals without aggressive deficit framing.',
      'Keep guidance supportive and encourage personal clinical guidance for specific needs.'
    ],
    safetyRules: [
      'Do not recommend aggressive weight loss, strict deficits, or extreme macro rules.',
      'Do not provide diagnosis, medical claims, or pregnancy-specific treatment advice.'
    ]
  },
  UNDER_18_SAFE: {
    id: 'UNDER_18_SAFE',
    title: 'Under-18 safe nutrition',
    rules: [
      'Focus on balanced meals, hydration, sleep, recovery, and healthy movement.',
      'Support consistency and energy rather than weight pressure.'
    ],
    safetyRules: [
      'Do not recommend strict calorie deficits, aggressive weight loss, or body-image pressure.',
      'Recommend involving a trusted adult or qualified professional for serious goals.'
    ]
  },
  RECOVERY_DAY: {
    id: 'RECOVERY_DAY',
    title: 'Recovery day nutrition',
    rules: [
      'Support recovery with regular meals, hydration, protein, and easy-to-digest options.',
      'Keep meals gentle and practical when tiredness or discomfort is reported.'
    ],
    safetyRules: [
      'Do not encourage restriction to compensate for a lower-activity day.',
      'Do not use punishment or guilt-based language.'
    ]
  }
};
