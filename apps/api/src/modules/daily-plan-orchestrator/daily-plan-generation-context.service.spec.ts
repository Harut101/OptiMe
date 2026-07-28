import {
  GoalImpactMode,
  PlanFeedbackRating,
  PlanQualityMode,
  PreferredLocale,
  TrainingLevel
} from '@prisma/client';

import { DailyPlanGenerationContextService } from './daily-plan-generation-context.service';
import type { DailyPlanPlanningUser } from './daily-plan-planning-user';

describe('DailyPlanGenerationContextService', () => {
  it('prepares a nutrition-only context without selecting exercises', async () => {
    const { service, dependencies } = createService({
      user: createUser({ noTrainingPlanned: true })
    });

    const result = await service.prepare({
      user: dependencies.user,
      planLocalDate: '2026-07-26'
    });

    expect(result.appMode).toBe(GoalImpactMode.NUTRITION_ONLY);
    expect(result.trainingEnabled).toBe(false);
    expect(result.exerciseSelection.requestedExerciseCount).toBe(0);
    expect(dependencies.trainingPlanAgent.selectCandidates).not.toHaveBeenCalled();
    expect(result.blockedFoods).toEqual({
      allergies: ['avocado'],
      excludedFoods: ['pork']
    });
  });

  it('builds training candidates from the resolved day, locale, protocol, and health signals', async () => {
    const { service, dependencies } = createService({
      user: createUser({ noTrainingPlanned: false })
    });

    const result = await service.prepare({
      user: dependencies.user,
      planLocalDate: '2026-07-26'
    });

    expect(result.trainingEnabled).toBe(true);
    expect(dependencies.trainingPlanAgent.selectCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'ru-RU',
        planDate: '2026-07-26',
        workoutDurationMinutes: 60,
        trainingLevel: TrainingLevel.INTERMEDIATE,
        healthSignals: {
          lowSleep: true,
          lowRecovery: false,
          highActivity: false,
          lowStepTrend: false
        }
      })
    );
  });

  it('adds bounded feedback and history summaries for ADAPTIVE context', async () => {
    const { service, dependencies } = createService({
      user: createUser({ noTrainingPlanned: false }),
      planQualityMode: PlanQualityMode.ADAPTIVE
    });
    dependencies.prisma.dailyPlanFeedback.findMany.mockResolvedValue([
      { rating: PlanFeedbackRating.HELPFUL, tags: ['FELT_GOOD'] },
      { rating: PlanFeedbackRating.NOT_HELPFUL, tags: ['LOW_ENERGY'] }
    ]);
    dependencies.prisma.dailyPlan.findMany.mockResolvedValue([
      {
        status: 'FALLBACK',
        readinessLevel: 'RECOVER',
        planLocalDate: '2026-07-25',
        planTimezone: 'UTC',
        planJson: {}
      }
    ]);

    const result = await service.prepare({
      user: dependencies.user,
      planLocalDate: '2026-07-26'
    });

    expect(result.personalizationContext.feedbackSummary).toEqual({
      helpfulCount: 1,
      notHelpfulCount: 1,
      commonTags: ['FELT_GOOD', 'LOW_ENERGY']
    });
    expect(result.personalizationContext.historySummary).toEqual({
      recentPlanCount: 1,
      readinessLevels: ['RECOVER'],
      fallbackCount: 1
    });
    expect(dependencies.prisma.dailyPlanFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });
});

function createService(input: {
  user: DailyPlanPlanningUser;
  planQualityMode?: PlanQualityMode;
}) {
  const prisma = {
    dailyPlanFeedback: { findMany: jest.fn().mockResolvedValue([]) },
    dailyPlan: { findMany: jest.fn().mockResolvedValue([]) }
  };
  const checkInsService = {
    getRecentSummary: jest.fn().mockResolvedValue({
      painOrDiscomfortReported: false,
      highTirednessReported: false
    })
  };
  const featureAccessService = {
    getPlanQualityMode: jest
      .fn()
      .mockResolvedValue(input.planQualityMode ?? PlanQualityMode.BASIC)
  };
  const foodAvailabilityService = {
    getAvailableFoodSlugs: jest.fn().mockResolvedValue(['rice', 'chicken'])
  };
  const foodLogsService = {
    getRecentSummary: jest.fn().mockResolvedValue(null)
  };
  const healthService = {
    getRecentHealthSummariesForPlanning: jest.fn().mockResolvedValue({
      available: true,
      wearableContext: null,
      signals: {
        lowSleep: true,
        highActivityYesterday: false,
        recentWorkout: false,
        lowStepTrend: false
      },
      trainingLoadContext: {
        hasTrainingLoadContext: true,
        readinessHint: 'MAINTAIN',
        reasons: []
      }
    })
  };
  const nutritionTarget = { id: 'nutrition-target' };
  const nutritionTargetsService = {
    getPreview: jest.fn().mockResolvedValue(nutritionTarget)
  };
  const selectedProtocols = {
    nutritionProtocol: { id: 'nutrition-balanced' },
    trainingProtocol: { id: 'training-strength' },
    recoveryProtocol: { id: 'recovery-normal' },
    selectionReasons: []
  };
  const protocolSelector = {
    select: jest.fn().mockReturnValue(selectedProtocols)
  };
  const exerciseSelection = {
    candidates: [{ resolvedLocale: 'ru-RU' }],
    requestedExerciseCount: 4,
    minExerciseCount: 3,
    maxExerciseCount: 5,
    candidatePoolLimit: 8,
    workoutDurationMinutes: 60,
    volumePlan: {
      targetExerciseCount: 4,
      minExerciseCount: 3,
      maxExerciseCount: 5,
      suggestedSetsPerExercise: 3,
      suggestedRestSeconds: 60,
      estimatedSessionMinutes: 55,
      warmupMinutes: 5,
      cooldownMinutes: 5,
      transitionSecondsPerExercise: 30,
      volumeReasonCodes: []
    },
    normalizedTargetMuscles: ['CHEST'],
    fallbackMode: 'NONE',
    internalExclusionSummary: {}
  };
  const trainingPlanAgent = {
    selectCandidates: jest.fn().mockResolvedValue(exerciseSelection)
  };
  const trainingScheduleResolver = {
    resolveForUser: jest.fn().mockResolvedValue({
      source: 'WEEKLY_SCHEDULE',
      localDate: '2026-07-26',
      dayOfWeek: 'SUNDAY',
      isTrainingDay: !input.user.noTrainingPlanned,
      targetMuscles: ['CHEST'],
      environment: 'GYM',
      availableEquipment: ['DUMBBELLS'],
      durationMinutes: input.user.noTrainingPlanned ? 0 : 60
    })
  };
  const service = new DailyPlanGenerationContextService(
    prisma as never,
    checkInsService as never,
    featureAccessService as never,
    foodAvailabilityService as never,
    foodLogsService as never,
    healthService as never,
    nutritionTargetsService as never,
    protocolSelector as never,
    trainingPlanAgent as never,
    trainingScheduleResolver as never
  );

  return {
    service,
    dependencies: {
      user: input.user,
      prisma,
      trainingPlanAgent
    }
  };
}

function createUser(input: {
  noTrainingPlanned: boolean;
}): DailyPlanPlanningUser {
  return {
    id: 'user-1',
    firstName: 'User',
    timezone: 'UTC',
    locale: 'en',
    isMinor: false,
    safeMode: false,
    noTrainingPlanned: input.noTrainingPlanned,
    privacyConsentedAt: new Date(),
    settings: { preferredLocale: PreferredLocale.RU_RU },
    profile: {
      gender: 'FEMALE',
      pregnancyStatus: 'NOT_PREGNANT',
      dateOfBirth: new Date('1990-01-01'),
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'MODERATE'
    },
    goal: {
      goalType: 'BUILD_MUSCLE',
      primaryGoal: 'BUILD_MUSCLE',
      targetWeightKg: null,
      targetTimelineDays: null,
      impactMode: input.noTrainingPlanned
        ? GoalImpactMode.NUTRITION_ONLY
        : GoalImpactMode.NUTRITION_AND_TRAINING
    },
    nutritionPref: {
      dietType: 'NONE',
      mealsPerDay: 3,
      notes: null,
      noKnownAllergiesConfirmed: false,
      allergies: [{ name: 'avocado' }],
      excludedFoods: [{ name: 'pork' }],
      dislikedFoods: [],
      preferredFoods: [{ name: 'rice' }]
    },
    schedules: [],
    weeklyTrainingSchedule: { isActive: true },
    trainingPreference: {
      targetMuscleGroups: ['CHEST'],
      trainingOutcome: 'STRENGTH',
      equipment: ['DUMBBELLS'],
      trainingLevel: TrainingLevel.INTERMEDIATE,
      limitationsOrPainAreas: [],
      preferredTrainingDays: ['SUNDAY']
    },
    progressiveProfilePrompts: []
  } as unknown as DailyPlanPlanningUser;
}
