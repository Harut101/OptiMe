import { PlanQualityMode, SubscriptionPlan, UsageFeature, UsagePeriodType } from '@prisma/client';

export const FEATURE_ENTITLEMENT_KEYS = {
  DAILY_PLAN_GENERATION: 'DAILY_PLAN_GENERATION',
  AI_NUTRITION_AGENT: 'AI_NUTRITION_AGENT',
  MEAL_REGENERATION: 'MEAL_REGENERATION',
  MENU_REGENERATION: 'MENU_REGENERATION',
  AI_TRAINING_LOAD_AGENT: 'AI_TRAINING_LOAD_AGENT',
  PAIN_AWARE_REPLACEMENTS: 'PAIN_AWARE_REPLACEMENTS',
  WORKOUT_EXECUTION: 'WORKOUT_EXECUTION',
  WORKOUT_HISTORY: 'WORKOUT_HISTORY',
  FOOD_TRACKING: 'FOOD_TRACKING',
  APPLE_HEALTH_SYNC: 'APPLE_HEALTH_SYNC',
  WEARABLE_CONTEXT: 'WEARABLE_CONTEXT',
  ADVANCED_WEARABLE_INSIGHTS: 'ADVANCED_WEARABLE_INSIGHTS',
  HEALTH_CONNECT: 'HEALTH_CONNECT',
  WHOOP: 'WHOOP',
  AI_COACH: 'AI_COACH',
  WEEKLY_REPORTS: 'WEEKLY_REPORTS'
} as const;

export type FeatureEntitlementKey =
  (typeof FEATURE_ENTITLEMENT_KEYS)[keyof typeof FEATURE_ENTITLEMENT_KEYS];

export interface FeatureAccessMatrix {
  canGenerateDailyPlan: boolean;
  canRefreshPlan: boolean;
  canUseOpenAIProvider: boolean;
  canUseAdvancedPersonalization: boolean;
  canUseFeedbackPersonalization: boolean;
  canViewHistory: boolean;
  canSubmitFeedback: boolean;
  canUseWeeklyReports: boolean;
  canUseWhoop: boolean;
  canUseAiCoach: boolean;
  canRegenerateMeals: boolean;
  canRegenerateMenus: boolean;
  canUseAiTrainingLoadAgent: boolean;
  canUsePainAwareReplacements: boolean;
  canUseWorkoutExecution: boolean;
  canUseWorkoutHistory: boolean;
  canUseFoodTracking: boolean;
  canUseAppleHealthSync: boolean;
  canUseWearableContext: boolean;
  canUseAdvancedWearableInsights: boolean;
  canUseHealthConnect: boolean;
}

export interface UsageLimitMatrixEntry {
  feature: UsageFeature;
  periodType: UsagePeriodType;
  limits: Record<SubscriptionPlan, number>;
}

export const PLAN_QUALITY_BY_TIER: Record<SubscriptionPlan, PlanQualityMode> = {
  [SubscriptionPlan.FREE]: PlanQualityMode.BASIC,
  [SubscriptionPlan.PLUS]: PlanQualityMode.PERSONALIZED,
  [SubscriptionPlan.PRO]: PlanQualityMode.ADAPTIVE
};

export const FEATURE_ACCESS_MATRIX: Record<SubscriptionPlan, FeatureAccessMatrix> = {
  [SubscriptionPlan.FREE]: {
    canGenerateDailyPlan: true,
    canRefreshPlan: false,
    canUseOpenAIProvider: true,
    canUseAdvancedPersonalization: false,
    canUseFeedbackPersonalization: false,
    canViewHistory: true,
    canSubmitFeedback: true,
    canUseWeeklyReports: false,
    canUseWhoop: false,
    canUseAiCoach: false,
    canRegenerateMeals: true,
    canRegenerateMenus: false,
    canUseAiTrainingLoadAgent: false,
    canUsePainAwareReplacements: true,
    canUseWorkoutExecution: true,
    canUseWorkoutHistory: true,
    canUseFoodTracking: true,
    canUseAppleHealthSync: true,
    canUseWearableContext: true,
    canUseAdvancedWearableInsights: false,
    canUseHealthConnect: false
  },
  [SubscriptionPlan.PLUS]: {
    canGenerateDailyPlan: true,
    canRefreshPlan: true,
    canUseOpenAIProvider: true,
    canUseAdvancedPersonalization: true,
    canUseFeedbackPersonalization: true,
    canViewHistory: true,
    canSubmitFeedback: true,
    canUseWeeklyReports: true,
    canUseWhoop: false,
    canUseAiCoach: false,
    canRegenerateMeals: true,
    canRegenerateMenus: true,
    canUseAiTrainingLoadAgent: true,
    canUsePainAwareReplacements: true,
    canUseWorkoutExecution: true,
    canUseWorkoutHistory: true,
    canUseFoodTracking: true,
    canUseAppleHealthSync: true,
    canUseWearableContext: true,
    canUseAdvancedWearableInsights: false,
    canUseHealthConnect: false
  },
  [SubscriptionPlan.PRO]: {
    canGenerateDailyPlan: true,
    canRefreshPlan: true,
    canUseOpenAIProvider: true,
    canUseAdvancedPersonalization: true,
    canUseFeedbackPersonalization: true,
    canViewHistory: true,
    canSubmitFeedback: true,
    canUseWeeklyReports: true,
    canUseWhoop: true,
    canUseAiCoach: true,
    canRegenerateMeals: true,
    canRegenerateMenus: true,
    canUseAiTrainingLoadAgent: true,
    canUsePainAwareReplacements: true,
    canUseWorkoutExecution: true,
    canUseWorkoutHistory: true,
    canUseFoodTracking: true,
    canUseAppleHealthSync: true,
    canUseWearableContext: true,
    canUseAdvancedWearableInsights: true,
    canUseHealthConnect: false
  }
};

export const USAGE_LIMIT_MATRIX: UsageLimitMatrixEntry[] = [
  {
    feature: UsageFeature.DAILY_PLAN_GENERATION,
    periodType: UsagePeriodType.DAILY,
    limits: {
      [SubscriptionPlan.FREE]: 1,
      [SubscriptionPlan.PLUS]: 1,
      [SubscriptionPlan.PRO]: 1
    }
  },
  {
    feature: UsageFeature.DAILY_PLAN_REFRESH,
    periodType: UsagePeriodType.MONTHLY,
    limits: {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PLUS]: 3,
      [SubscriptionPlan.PRO]: 10
    }
  },
  {
    feature: UsageFeature.AI_DAILY_PLAN_GENERATION,
    periodType: UsagePeriodType.DAILY,
    limits: {
      [SubscriptionPlan.FREE]: 1,
      [SubscriptionPlan.PLUS]: 1,
      [SubscriptionPlan.PRO]: 1
    }
  },
  {
    feature: UsageFeature.AI_PLAN_CHECKPOINT_PROPOSAL,
    periodType: UsagePeriodType.MONTHLY,
    limits: {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PLUS]: 8,
      [SubscriptionPlan.PRO]: 20
    }
  },
  {
    feature: UsageFeature.MENU_REGENERATION,
    periodType: UsagePeriodType.MONTHLY,
    limits: {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PLUS]: 2,
      [SubscriptionPlan.PRO]: 6
    }
  },
  {
    feature: UsageFeature.MEAL_REGENERATION,
    periodType: UsagePeriodType.MONTHLY,
    limits: {
      [SubscriptionPlan.FREE]: 2,
      [SubscriptionPlan.PLUS]: 8,
      [SubscriptionPlan.PRO]: 15
    }
  },
  {
    feature: UsageFeature.AI_TRAINING_LOAD_AGENT,
    periodType: UsagePeriodType.DAILY,
    limits: {
      [SubscriptionPlan.FREE]: 0,
      [SubscriptionPlan.PLUS]: 2,
      [SubscriptionPlan.PRO]: 3
    }
  }
];
