import { DailyReadinessLevel, HealthProvider } from '@prisma/client';
import type { PlanCheckpointFacts } from '@optime/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { createSafeFallbackPlan } from '../safety/safe-fallback-plan.factory';
import { PlanCheckpointMaterialChangeDetectorService } from './plan-checkpoint-material-change-detector.service';
import { PlanCheckpointService } from './plan-checkpoint.service';

const userId = 'user-1';
const dailyPlanId = 'plan-1';
const planLocalDate = '2026-07-26';

function createBaseline(overrides: Partial<PlanCheckpointFacts> = {}): PlanCheckpointFacts {
  return {
    capturedAt: '2026-07-26T08:00:00.000Z',
    health: {
      source: null,
      localDate: null,
      sleepMinutes: null,
      steps: null,
      activeCaloriesKcal: null,
      workoutMinutes: null,
      ...overrides.health
    },
    progress: {
      completedMeals: 0,
      skippedMeals: 0,
      workoutStatus: 'NOT_STARTED',
      ...overrides.progress
    },
    checkIn: {
      energyLevel: null,
      tirednessLevel: null,
      sorenessLevel: null,
      ...overrides.checkIn
    },
    safetySignals: {
      painOrLimitation: false,
      illness: false,
      dizziness: false,
      exhaustion: false,
      ...overrides.safetySignals
    }
  };
}

function createPlan(checkpointBaseline?: PlanCheckpointFacts) {
  return {
    id: dailyPlanId,
    userId,
    planLocalDate,
    planTimezone: 'UTC',
    status: 'READY',
    readinessLevel: DailyReadinessLevel.MAINTAIN,
    planJson: {
      ...createSafeFallbackPlan({
        planLocalDate,
        planTimezone: 'UTC'
      }),
      ...(checkpointBaseline ? { checkpointBaseline } : {})
    },
    createdByAi: false,
    createdAt: new Date('2026-07-26T08:00:00.000Z'),
    updatedAt: new Date('2026-07-26T08:00:00.000Z'),
    foodDayLogs: [],
    workoutSessions: [],
    checkIns: []
  };
}

describe('PlanCheckpointService', () => {
  const prisma = {
    dailyPlan: {
      findFirst: jest.fn(),
      update: jest.fn()
    },
    wearableDailySnapshot: {
      findMany: jest.fn()
    }
  };
  const service = new PlanCheckpointService(
    prisma as unknown as PrismaService,
    new PlanCheckpointMaterialChangeDetectorService()
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.wearableDailySnapshot.findMany.mockResolvedValue([]);
  });

  it('captures a backend-owned generation baseline from structured facts', async () => {
    prisma.dailyPlan.findFirst.mockResolvedValue(createPlan());
    prisma.wearableDailySnapshot.findMany.mockResolvedValue([
      {
        source: HealthProvider.APPLE_HEALTH,
        localDate: planLocalDate,
        sleepMinutes: 430,
        steps: 2400,
        activeCaloriesKcal: 180,
        workoutMinutes: 0,
        capturedAt: new Date('2026-07-26T08:30:00.000Z'),
        updatedAt: new Date('2026-07-26T08:30:00.000Z')
      }
    ]);

    const baseline = await service.captureGenerationBaseline(
      userId,
      planLocalDate,
      dailyPlanId
    );

    expect(baseline.health).toEqual({
      source: 'APPLE_HEALTH',
      localDate: planLocalDate,
      sleepMinutes: 430,
      steps: 2400,
      activeCaloriesKcal: 180,
      workoutMinutes: 0
    });
    expect(baseline.progress).toEqual({
      completedMeals: 0,
      skippedMeals: 0,
      workoutStatus: 'NOT_STARTED'
    });
  });

  it('initializes an old plan baseline without reporting a false change', async () => {
    prisma.dailyPlan.findFirst.mockResolvedValue(createPlan());
    prisma.dailyPlan.update.mockResolvedValue({});

    const result = await service.evaluate(userId, dailyPlanId, {
      trigger: 'APP_OPEN'
    });

    expect(result).toMatchObject({
      dailyPlanId,
      planLocalDate,
      baselineInitialized: true,
      materialChangeDetected: false,
      reviewRecommended: false,
      reasonCodes: []
    });
    expect(prisma.dailyPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: dailyPlanId }
      })
    );
  });

  it('detects a material sleep change against the saved plan baseline', async () => {
    prisma.dailyPlan.findFirst.mockResolvedValue(
      createPlan(
        createBaseline({
          health: {
            source: 'APPLE_HEALTH',
            localDate: planLocalDate,
            sleepMinutes: 480,
            steps: 1000,
            activeCaloriesKcal: 100,
            workoutMinutes: 0
          }
        })
      )
    );
    prisma.wearableDailySnapshot.findMany.mockResolvedValue([
      {
        source: HealthProvider.APPLE_HEALTH,
        localDate: planLocalDate,
        sleepMinutes: 300,
        steps: 1000,
        activeCaloriesKcal: 100,
        workoutMinutes: 0,
        capturedAt: new Date('2026-07-26T10:00:00.000Z'),
        updatedAt: new Date('2026-07-26T10:00:00.000Z')
      }
    ]);

    const result = await service.evaluate(userId, dailyPlanId, {
      trigger: 'HEALTH_SYNC'
    });

    expect(result).toMatchObject({
      baselineInitialized: false,
      materialChangeDetected: true,
      reviewRecommended: true,
      severity: 'HIGH'
    });
    expect(result.reasonCodes).toEqual(
      expect.arrayContaining(['LOW_SLEEP_DETECTED', 'SLEEP_DECREASED'])
    );
    expect(prisma.dailyPlan.update).not.toHaveBeenCalled();
  });

  it('does not expose another user plan through checkpoint evaluation', async () => {
    prisma.dailyPlan.findFirst.mockResolvedValue(null);

    await expect(
      service.evaluate('other-user', dailyPlanId, { trigger: 'APP_OPEN' })
    ).rejects.toThrow('Daily plan not found.');
    expect(prisma.wearableDailySnapshot.findMany).not.toHaveBeenCalled();
    expect(prisma.dailyPlan.update).not.toHaveBeenCalled();
  });
});
