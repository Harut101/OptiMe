import {
  SubscriptionPlan,
  UsageFeature,
  UsagePeriodType
} from '@prisma/client';

import { USAGE_LIMIT_MATRIX } from './entitlement-matrix';

describe('USAGE_LIMIT_MATRIX', () => {
  it('keeps meal regeneration useful but bounded by tier', () => {
    expect(getLimits(UsageFeature.MEAL_REGENERATION)).toEqual({
      periodType: UsagePeriodType.MONTHLY,
      limits: {
        [SubscriptionPlan.FREE]: 2,
        [SubscriptionPlan.PLUS]: 8,
        [SubscriptionPlan.PRO]: 15
      }
    });
  });

  it('bounds the internal AI training-load enhancement', () => {
    expect(getLimits(UsageFeature.AI_TRAINING_LOAD_AGENT)).toEqual({
      periodType: UsagePeriodType.DAILY,
      limits: {
        [SubscriptionPlan.FREE]: 0,
        [SubscriptionPlan.PLUS]: 2,
        [SubscriptionPlan.PRO]: 3
      }
    });
  });
});

function getLimits(feature: UsageFeature) {
  const entry = USAGE_LIMIT_MATRIX.find(
    (candidate) => candidate.feature === feature
  );

  expect(entry).toBeDefined();
  return {
    periodType: entry?.periodType,
    limits: entry?.limits
  };
}
