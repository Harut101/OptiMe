import { RecoveryProtocol, RecoveryProtocolId } from './protocol.types';

export const recoveryProtocols: Record<RecoveryProtocolId, RecoveryProtocol> = {
  NORMAL_RECOVERY: {
    id: 'NORMAL_RECOVERY',
    title: 'Normal recovery',
    rules: [
      'Support the planned day with hydration, sleep consistency, and simple mobility.',
      'Keep recovery advice practical and non-medical.'
    ],
    safetyRules: [
      'Do not diagnose recovery status.',
      'Do not imply the user must push if they feel unwell.'
    ]
  },
  HIGH_TIREDNESS: {
    id: 'HIGH_TIREDNESS',
    title: 'High tiredness recovery',
    rules: [
      'Favor lower intensity, earlier wind-down, hydration, and gentle movement.',
      'Keep training recommendations conservative.'
    ],
    safetyRules: [
      'Do not encourage hard training through exhaustion.',
      'Do not shame rest or reduced intensity.'
    ]
  },
  PAIN_OR_DISCOMFORT: {
    id: 'PAIN_OR_DISCOMFORT',
    title: 'Pain or discomfort recovery',
    rules: [
      'Prefer rest, gentle mobility, and avoiding aggravating movements.',
      'Encourage stopping activity if symptoms worsen.'
    ],
    safetyRules: [
      'Do not diagnose pain or injury.',
      'Do not tell the user to push through pain.'
    ]
  },
  PREGNANCY_POSTPARTUM_CONSERVATIVE: {
    id: 'PREGNANCY_POSTPARTUM_CONSERVATIVE',
    title: 'Pregnancy/postpartum conservative recovery',
    rules: [
      'Favor hydration, balanced meals, gentle movement, and rest.',
      'Keep guidance conservative and supportive.'
    ],
    safetyRules: [
      'Do not make medical claims or prescribe pregnancy/postpartum treatment.',
      'Do not recommend aggressive training or weight-loss behavior.'
    ]
  },
  REST_DAY: {
    id: 'REST_DAY',
    title: 'Rest day recovery',
    rules: [
      'Respect rest as a productive part of consistency.',
      'Use optional light walking or mobility only if the user feels well.'
    ],
    safetyRules: [
      'Do not pressure the user to compensate with exercise.',
      'Do not frame rest as failure.'
    ]
  },
  HIGH_SORENESS: {
    id: 'HIGH_SORENESS',
    title: 'High soreness recovery',
    rules: [
      'Favor easy movement, hydration, and sleep consistency.',
      'Reduce training intensity and avoid aggravating sore areas.'
    ],
    safetyRules: [
      'Do not recommend hard training through severe soreness.',
      'Do not diagnose the cause of soreness.'
    ]
  }
};
