import type { PrismaService } from '../../prisma/prisma.service';
import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import type { FeatureAccessService } from '../entitlements/feature-access.service';
import type { TrainingPlanAgentService } from '../training-plan-agent/training-plan-agent.service';
import type { TrainingScheduleResolverService } from '../training-schedule/training-schedule-resolver.service';
import type {
  PainAwareExerciseReplacementService,
  TrainingReplacementProposalResult
} from '../daily-plans/pain-aware-exercise-replacement.service';
import type { DailyPlanOrchestratorService } from './daily-plan-orchestrator.service';
import { DailyPlanTrainingAdjustmentUseCaseService } from './daily-plan-training-adjustment-use-case.service';

describe('DailyPlanTrainingAdjustmentUseCaseService', () => {
  it('applies all available replacements during direct adjustment', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const proposalResult = createProposalResult();
    jest
      .spyOn(
        service as never,
        'buildTrainingReplacementProposalResult' as never
      )
      .mockResolvedValue(proposalResult as never);
    const applySpy = jest
      .spyOn(service, 'applyReplacements')
      .mockResolvedValue({ id: 'updated-plan' } as never);

    const result = await service.adjustForPreWorkout({
      userId: 'user-1',
      dailyPlanId: 'plan-1',
      preWorkoutCheck: {
        readinessStatus: 'PAIN_OR_LIMITATION',
        painAreas: ['SHOULDERS']
      }
    });

    expect(result).toEqual({ id: 'updated-plan' });
    expect(applySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictingExerciseKeys: ['plan-1:exercise-1'],
        acceptedOriginalPlanExerciseKeys: [
          'plan-1:exercise-1'
        ]
      })
    );
  });

  it('does not expose internal replacement exercise payloads', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    jest
      .spyOn(
        service as never,
        'buildTrainingReplacementProposalResult' as never
      )
      .mockResolvedValue(createProposalResult() as never);

    const result = await service.getReplacementProposals({
      userId: 'user-1',
      dailyPlanId: 'plan-1',
      preWorkoutCheck: {
        readinessStatus: 'PAIN_OR_LIMITATION',
        painAreas: ['SHOULDERS']
      },
      conflictingExerciseKeys: ['plan-1:exercise-1']
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).not.toHaveProperty(
      'replacementExercise'
    );
    expect(result.proposals[0]).toMatchObject({
      originalPlanExerciseKey: 'plan-1:exercise-1',
      replacementExerciseId: 'replacement-1'
    });
  });

  it('validates accepted proposal keys before persisting', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const currentPlan = createMockDailyPlan({
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC',
      isMinor: false
    });
    jest
      .spyOn(
        service as never,
        'buildTrainingReplacementContext' as never
      )
      .mockResolvedValue({
        plan: { id: 'plan-1' },
        currentPlan,
        proposalResult: createProposalResult()
      } as never);

    await expect(
      service.applyReplacements({
        userId: 'user-1',
        dailyPlanId: 'plan-1',
        preWorkoutCheck: {
          readinessStatus: 'PAIN_OR_LIMITATION',
          painAreas: ['SHOULDERS']
        },
        conflictingExerciseKeys: ['plan-1:exercise-1'],
        acceptedOriginalPlanExerciseKeys: ['unknown-key']
      })
    ).rejects.toThrow(
      'One or more replacement selections are no longer available.'
    );
    expect(
      dependencies.painAwareExerciseReplacement.applyProposals
    ).not.toHaveBeenCalled();
    expect(
      dependencies.prisma.dailyPlan.update
    ).not.toHaveBeenCalled();
  });

  it('applies a valid replacement and persists a schema-valid plan', async () => {
    const dependencies = createDependencies();
    const service = createService(dependencies);
    const currentPlan = createMockDailyPlan({
      planLocalDate: '2026-07-26',
      planTimezone: 'UTC',
      isMinor: false
    });
    const proposalResult = createProposalResult();
    jest
      .spyOn(
        service as never,
        'buildTrainingReplacementContext' as never
      )
      .mockResolvedValue({
        plan: { id: 'plan-1' },
        currentPlan,
        proposalResult
      } as never);
    dependencies.painAwareExerciseReplacement.applyProposals.mockReturnValue(
      currentPlan
    );
    dependencies.prisma.dailyPlan.update.mockResolvedValue({
      id: 'updated-plan'
    } as never);

    const result = await service.applyReplacements({
      userId: 'user-1',
      dailyPlanId: 'plan-1',
      preWorkoutCheck: {
        readinessStatus: 'PAIN_OR_LIMITATION',
        painAreas: ['SHOULDERS']
      },
      conflictingExerciseKeys: ['plan-1:exercise-1'],
      acceptedOriginalPlanExerciseKeys: [
        'plan-1:exercise-1'
      ]
    });

    expect(result).toEqual({ id: 'updated-plan' });
    expect(
      dependencies.painAwareExerciseReplacement.applyProposals
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyPlanId: 'plan-1',
        acceptedOriginalPlanExerciseKeys: [
          'plan-1:exercise-1'
        ]
      })
    );
    expect(
      dependencies.prisma.dailyPlan.update
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'plan-1' }
      })
    );
  });
});

function createService(
  dependencies: ReturnType<typeof createDependencies>
) {
  return new DailyPlanTrainingAdjustmentUseCaseService(
    dependencies.prisma as unknown as PrismaService,
    dependencies.featureAccessService,
    dependencies.trainingPlanAgent,
    dependencies.trainingScheduleResolver,
    dependencies.painAwareExerciseReplacement,
    dependencies.orchestrator
  );
}

function createDependencies() {
  return {
    prisma: {
      workoutSession: {
        findUnique: jest.fn()
      },
      dailyPlan: {
        findFirst: jest.fn(),
        update: jest.fn()
      },
      user: {
        findUnique: jest.fn()
      }
    },
    featureAccessService: {
      getPlanQualityMode: jest.fn()
    } as unknown as jest.Mocked<FeatureAccessService>,
    trainingPlanAgent: {
      selectCandidates: jest.fn()
    } as unknown as jest.Mocked<TrainingPlanAgentService>,
    trainingScheduleResolver: {
      resolveForUser: jest.fn()
    } as unknown as jest.Mocked<TrainingScheduleResolverService>,
    painAwareExerciseReplacement: {
      buildProposals: jest.fn(),
      applyProposals: jest.fn()
    } as unknown as jest.Mocked<PainAwareExerciseReplacementService>,
    orchestrator: {
      resolveAppMode: jest.fn(),
      preparePersonalizationContext: jest.fn(),
      buildExerciseSelectionContext: jest.fn()
    } as unknown as jest.Mocked<DailyPlanOrchestratorService>
  };
}

function createProposalResult(): TrainingReplacementProposalResult {
  const replacementExercise = createMockDailyPlan({
    planLocalDate: '2026-07-26',
    planTimezone: 'UTC',
    isMinor: false
  }).training.exercises?.[0];

  if (!replacementExercise) {
    throw new Error('Mock exercise is required.');
  }

  return {
    status: 'REPLACEMENTS_AVAILABLE',
    painAreas: ['SHOULDERS'],
    avoidedMuscleGroups: ['SHOULDERS'],
    proposals: [
      {
        originalPlanExerciseKey: 'plan-1:exercise-1',
        originalExerciseId: 'exercise-1',
        originalSlug: 'overhead-press',
        originalName: 'Overhead press',
        replacementExerciseId: 'replacement-1',
        replacementSlug: 'bodyweight-squat',
        replacementName: 'Bodyweight squat',
        reasonCodes: ['PAIN_AWARE_REPLACEMENT'],
        avoidedMuscleGroups: ['SHOULDERS'],
        targetMuscles: ['QUADRICEPS'],
        equipment: ['BODYWEIGHT'],
        prescription: {
          sets: 3,
          reps: '8-10',
          durationSeconds: null,
          restSeconds: 60
        },
        replacementExercise
      }
    ],
    unresolvedConflicts: []
  } as TrainingReplacementProposalResult;
}
