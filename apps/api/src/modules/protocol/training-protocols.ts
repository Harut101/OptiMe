import { TrainingProtocol, TrainingProtocolId } from './protocol.types';

export const trainingProtocols: Record<TrainingProtocolId, TrainingProtocol> = {
  STRENGTH: {
    id: 'STRENGTH',
    title: 'Strength training',
    recommendedIntensity: 'MODERATE',
    exerciseGuidance: [
      'Prefer controlled compound patterns and clear technique cues.',
      'Keep effort challenging but not maximal unless the user context clearly supports it.'
    ],
    safetyRules: [
      'Do not recommend maximal lifts for beginners or users with pain/illness signals.',
      'Do not tell the user to train through pain, dizziness, illness, injury, or exhaustion.'
    ]
  },
  MUSCLE_GROWTH: {
    id: 'MUSCLE_GROWTH',
    title: 'Muscle growth training',
    recommendedIntensity: 'MODERATE',
    exerciseGuidance: [
      'Use hypertrophy-style guidance with controlled reps, rest, and progressive consistency.',
      'Match exercises to available equipment and training level.'
    ],
    safetyRules: [
      'Do not recommend unsafe volume jumps.',
      'Reduce intensity when recovery or pain signals are present.'
    ]
  },
  ENDURANCE: {
    id: 'ENDURANCE',
    title: 'Endurance training',
    recommendedIntensity: 'MODERATE',
    exerciseGuidance: [
      'Favor sustainable aerobic work and pacing guidance.',
      'Use intervals only when safe for the user level and current readiness.'
    ],
    safetyRules: [
      'Do not recommend hard intervals when pain, illness, dizziness, or exhaustion is reported.',
      'Keep beginner endurance guidance conservative.'
    ]
  },
  MOBILITY: {
    id: 'MOBILITY',
    title: 'Mobility and general movement',
    recommendedIntensity: 'LIGHT',
    exerciseGuidance: [
      'Use gentle mobility, walking, and low-impact movement.',
      'Keep movements simple and easy to stop if discomfort appears.'
    ],
    safetyRules: [
      'Do not diagnose pain or injury.',
      'Do not imply mobility work replaces medical care.'
    ]
  },
  RECOVERY: {
    id: 'RECOVERY',
    title: 'Recovery training',
    recommendedIntensity: 'REST',
    exerciseGuidance: [
      'Prefer rest, light walking, breathing, or gentle mobility.',
      'Reduce training demands when recent check-ins show high tiredness.'
    ],
    safetyRules: [
      'Do not recommend pushing through fatigue, illness, pain, or dizziness.',
      'Do not frame rest as failure.'
    ]
  },
  BEGINNER_GYM: {
    id: 'BEGINNER_GYM',
    title: 'Beginner gym training',
    recommendedIntensity: 'LIGHT',
    exerciseGuidance: [
      'Use simple machines, bodyweight basics, and technique-first strength patterns.',
      'Keep sets, reps, and rest conservative and easy to follow.'
    ],
    safetyRules: [
      'Do not prescribe advanced lifts or high-intensity finishers.',
      'Avoid unsafe loading or progression.'
    ]
  },
  HOME_WORKOUT: {
    id: 'HOME_WORKOUT',
    title: 'Home workout',
    recommendedIntensity: 'MODERATE',
    exerciseGuidance: [
      'Prefer bodyweight, dumbbell, or simple home equipment options.',
      'Offer practical alternatives when equipment is limited.'
    ],
    safetyRules: [
      'Do not assume gym machines or specialized equipment are available.',
      'Reduce intensity when recovery or pain signals are present.'
    ]
  },
  NO_TRAINING_PLANNED: {
    id: 'NO_TRAINING_PLANNED',
    title: 'No training planned',
    recommendedIntensity: 'REST',
    exerciseGuidance: [
      'Respect the no-training intent and suggest optional light movement only.',
      'Keep the plan focused on recovery, hydration, and consistency.'
    ],
    safetyRules: [
      'Do not pressure the user to train.',
      'Do not use guilt or punishment exercise language.'
    ]
  },
  CONSERVATIVE_PAIN_LIMITATION: {
    id: 'CONSERVATIVE_PAIN_LIMITATION',
    title: 'Conservative training with limitations',
    recommendedIntensity: 'LIGHT',
    exerciseGuidance: [
      'Prefer rest, gentle mobility, walking, or low-impact alternatives.',
      'Avoid loading or movements that could aggravate reported limitations.'
    ],
    safetyRules: [
      'Do not diagnose pain or injury.',
      'Do not recommend training through pain, dizziness, illness, or exhaustion.'
    ]
  }
};
