import request from 'supertest';
import {
  DailyReadinessLevel,
  HealthProvider,
  PlanCheckpointProposalStatus,
  PlanStatus,
  Prisma
} from '@prisma/client';
import type { PlanCheckpointFacts } from '@optime/shared-types';

import type {
  AiProvider,
  GenerateDailyPlanInput,
  GeneratePlanCheckpointProposalInput
} from '../src/modules/ai/ai-provider.interface';
import { AI_PROVIDER } from '../src/modules/ai/ai-provider.token';
import { createSafeFallbackPlan } from '../src/modules/safety/safe-fallback-plan.factory';
import {
  SAFETY_AGENT,
  SAFETY_AGENT_CONFIG
} from '../src/modules/safety-agent/safety-agent.token';
import { authHeader, registerTestUser } from './helpers/auth';
import { cleanupDatabase } from './helpers/cleanup';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Adaptive plan checkpoint evaluation', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase(ctx.prisma);
  });

  afterAll(async () => {
    if (ctx) {
      await cleanupDatabase(ctx.prisma);
      await ctx.app.close();
    }
  });

  it('requires authentication', async () => {
    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/plan-1/checkpoint/evaluate')
      .send({ trigger: 'APP_OPEN' })
      .expect(401);
  });

  it('does not generate a proposal when no material change is detected', async () => {
    const user = await registerTestUser(ctx.app);
    const baseline = createBaseline(480);
    const plan = await createPlan(user.user.id, baseline);
    const provider = ctx.app.get<AiProvider>(AI_PROVIDER);
    const proposalSpy = jest.spyOn(
      provider,
      'generatePlanCheckpointProposal'
    );

    try {
      const response = await request(ctx.app.getHttpServer())
        .post(`/v1/daily-plans/${plan.id}/checkpoint/propose`)
        .set(authHeader(user.accessToken))
        .send({ trigger: 'APP_OPEN' })
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'NOT_NEEDED',
        proposal: null,
        evaluation: {
          dailyPlanId: plan.id,
          materialChangeDetected: false
        }
      });
      expect(proposalSpy).not.toHaveBeenCalled();
    } finally {
      proposalSpy.mockRestore();
    }
  });

  it('initializes an old plan baseline without a false review prompt', async () => {
    const user = await registerTestUser(ctx.app);
    const plan = await createPlan(user.user.id);

    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/evaluate`)
      .set(authHeader(user.accessToken))
      .send({ trigger: 'APP_OPEN' })
      .expect(201);

    expect(response.body).toMatchObject({
      dailyPlanId: plan.id,
      planLocalDate: plan.planLocalDate,
      baselineInitialized: true,
      materialChangeDetected: false,
      reviewRecommended: false,
      severity: 'NONE',
      reasonCodes: []
    });

    const saved = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: plan.id }
    });
    expect(
      (saved.planJson as Record<string, unknown>).checkpointBaseline
    ).toBeDefined();
  });

  it('detects current health changes against the saved baseline', async () => {
    const user = await registerTestUser(ctx.app);
    const baseline = createBaseline(480);
    const plan = await createPlan(user.user.id, baseline);
    await ctx.prisma.wearableDailySnapshot.create({
      data: {
        userId: user.user.id,
        source: HealthProvider.APPLE_HEALTH,
        localDate: plan.planLocalDate,
        timezone: 'UTC',
        sleepMinutes: 300,
        capturedAt: new Date('2026-07-26T10:00:00.000Z')
      }
    });

    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/evaluate`)
      .set(authHeader(user.accessToken))
      .send({ trigger: 'HEALTH_SYNC' })
      .expect(201);

    expect(response.body).toMatchObject({
      baselineInitialized: false,
      materialChangeDetected: true,
      reviewRecommended: true,
      severity: 'HIGH'
    });
    expect(response.body.reasonCodes).toEqual(
      expect.arrayContaining(['LOW_SLEEP_DETECTED', 'SLEEP_DECREASED'])
    );
  });

  it('returns a safe preview proposal without changing the saved plan', async () => {
    const user = await registerTestUser(ctx.app);
    const baseline = createBaseline(480);
    const plan = await createPlan(user.user.id, baseline);
    const provider = ctx.app.get<AiProvider>(AI_PROVIDER);
    const proposalSpy = jest.spyOn(
      provider,
      'generatePlanCheckpointProposal'
    );
    await ctx.prisma.wearableDailySnapshot.create({
      data: {
        userId: user.user.id,
        source: HealthProvider.APPLE_HEALTH,
        localDate: plan.planLocalDate,
        timezone: 'UTC',
        sleepMinutes: 300,
        capturedAt: new Date('2026-07-26T10:00:00.000Z')
      }
    });

    const response = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/propose`)
      .set(authHeader(user.accessToken))
      .send({ trigger: 'HEALTH_SYNC' })
      .expect(201);

    expect(response.body).toMatchObject({
      status: 'READY',
      evaluation: {
        dailyPlanId: plan.id,
        materialChangeDetected: true,
        severity: 'HIGH'
      },
      proposal: {
        id: expect.any(String),
        proposalVersion: 'adaptive-checkpoint.v1',
        resolutionStatus: 'PENDING',
        sourceDailyPlanId: plan.id,
        trigger: 'HEALTH_SYNC',
        severity: 'HIGH',
        proposedPlan: {
          schemaVersion: 'sprint-2.v1',
          checkpointBaseline: {
            health: {
              sleepMinutes: 300
            }
          }
        }
      }
    });

    const saved = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: plan.id }
    });
    expect(saved.planJson).toEqual(plan.planJson);
    expect(saved.updatedAt.toISOString()).toBe(plan.updatedAt.toISOString());
    const storedProposal =
      await ctx.prisma.dailyPlanCheckpointProposal.findFirstOrThrow({
        where: { dailyPlanId: plan.id }
      });
    expect(storedProposal.status).toBe(PlanCheckpointProposalStatus.PENDING);
    expect(proposalSpy).toHaveBeenCalledTimes(1);
    proposalSpy.mockRestore();
  });

  it('returns only the current user pending proposal', async () => {
    const owner = await registerTestUser(ctx.app);
    const otherUser = await registerTestUser(ctx.app);
    const plan = await createPlan(owner.user.id, createBaseline(480));
    await createLowSleepSnapshot(ctx, owner.user.id, plan.planLocalDate);
    const proposalResponse = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/propose`)
      .set(authHeader(owner.accessToken))
      .send({ trigger: 'HEALTH_SYNC' })
      .expect(201);

    const ownerResponse = await request(ctx.app.getHttpServer())
      .get(`/v1/daily-plans/${plan.id}/checkpoint/proposal`)
      .set(authHeader(owner.accessToken))
      .expect(200);
    expect(ownerResponse.body).toMatchObject({
      proposal: {
        id: proposalResponse.body.proposal.id,
        resolutionStatus: 'PENDING'
      }
    });

    const otherResponse = await request(ctx.app.getHttpServer())
      .get(`/v1/daily-plans/${plan.id}/checkpoint/proposal`)
      .set(authHeader(otherUser.accessToken))
      .expect(200);
    expect(otherResponse.body).toEqual({ proposal: null });
  });

  it('applies an approved proposal only after explicit confirmation', async () => {
    const user = await registerTestUser(ctx.app);
    const plan = await createPlan(user.user.id, createBaseline(480));
    await createLowSleepSnapshot(ctx, user.user.id, plan.planLocalDate);
    const proposalResponse = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/propose`)
      .set(authHeader(user.accessToken))
      .send({ trigger: 'HEALTH_SYNC' })
      .expect(201);
    const proposal = proposalResponse.body.proposal;

    const beforeApply = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: plan.id }
    });
    expect(beforeApply.planJson).toEqual(plan.planJson);

    const applyResponse = await request(ctx.app.getHttpServer())
      .post(
        `/v1/daily-plans/${plan.id}/checkpoint/proposals/${proposal.id}/apply`
      )
      .set(authHeader(user.accessToken))
      .expect(201);

    expect(applyResponse.body).toMatchObject({
      id: plan.id,
      status: 'READY',
      plan: proposal.proposedPlan
    });
    const storedProposal =
      await ctx.prisma.dailyPlanCheckpointProposal.findUniqueOrThrow({
        where: { id: proposal.id }
      });
    expect(storedProposal.status).toBe(PlanCheckpointProposalStatus.APPLIED);
    expect(storedProposal.resolvedAt).not.toBeNull();
  });

  it('keeps the current plan and dismisses the proposal', async () => {
    const user = await registerTestUser(ctx.app);
    const plan = await createPlan(user.user.id, createBaseline(480));
    await createLowSleepSnapshot(ctx, user.user.id, plan.planLocalDate);
    const proposalResponse = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/propose`)
      .set(authHeader(user.accessToken))
      .send({ trigger: 'HEALTH_SYNC' })
      .expect(201);
    const proposal = proposalResponse.body.proposal;

    const keepResponse = await request(ctx.app.getHttpServer())
      .post(
        `/v1/daily-plans/${plan.id}/checkpoint/proposals/${proposal.id}/keep`
      )
      .set(authHeader(user.accessToken))
      .expect(201);
    expect(keepResponse.body).toEqual({
      id: proposal.id,
      resolutionStatus: 'DISMISSED'
    });

    const saved = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: plan.id }
    });
    expect(saved.planJson).toEqual(plan.planJson);
    const storedProposal =
      await ctx.prisma.dailyPlanCheckpointProposal.findUniqueOrThrow({
        where: { id: proposal.id }
      });
    expect(storedProposal.status).toBe(
      PlanCheckpointProposalStatus.DISMISSED
    );
  });

  it('expires a stale proposal without overwriting the latest plan', async () => {
    const user = await registerTestUser(ctx.app);
    const plan = await createPlan(user.user.id, createBaseline(480));
    await createLowSleepSnapshot(ctx, user.user.id, plan.planLocalDate);
    const proposalResponse = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/propose`)
      .set(authHeader(user.accessToken))
      .send({ trigger: 'HEALTH_SYNC' })
      .expect(201);
    const proposal = proposalResponse.body.proposal;
    const latestUpdatedAt = new Date(plan.updatedAt.getTime() + 5000);
    await ctx.prisma.dailyPlan.update({
      where: { id: plan.id },
      data: { updatedAt: latestUpdatedAt }
    });

    const applyResponse = await request(ctx.app.getHttpServer())
      .post(
        `/v1/daily-plans/${plan.id}/checkpoint/proposals/${proposal.id}/apply`
      )
      .set(authHeader(user.accessToken))
      .expect(409);
    expect(applyResponse.body).toMatchObject({
      code: 'CHECKPOINT_PROPOSAL_STALE'
    });

    const saved = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: { id: plan.id }
    });
    expect(saved.updatedAt.toISOString()).toBe(latestUpdatedAt.toISOString());
    expect(saved.planJson).toEqual(plan.planJson);
    const storedProposal =
      await ctx.prisma.dailyPlanCheckpointProposal.findUniqueOrThrow({
        where: { id: proposal.id }
      });
    expect(storedProposal.status).toBe(PlanCheckpointProposalStatus.EXPIRED);
  });

  it('does not allow another user to apply or dismiss a proposal', async () => {
    const owner = await registerTestUser(ctx.app);
    const otherUser = await registerTestUser(ctx.app);
    const plan = await createPlan(owner.user.id, createBaseline(480));
    await createLowSleepSnapshot(ctx, owner.user.id, plan.planLocalDate);
    const proposalResponse = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/propose`)
      .set(authHeader(owner.accessToken))
      .send({ trigger: 'HEALTH_SYNC' })
      .expect(201);
    const proposalId = proposalResponse.body.proposal.id;

    await request(ctx.app.getHttpServer())
      .post(
        `/v1/daily-plans/${plan.id}/checkpoint/proposals/${proposalId}/apply`
      )
      .set(authHeader(otherUser.accessToken))
      .expect(404);
    await request(ctx.app.getHttpServer())
      .post(
        `/v1/daily-plans/${plan.id}/checkpoint/proposals/${proposalId}/keep`
      )
      .set(authHeader(otherUser.accessToken))
      .expect(404);
  });

  it('rejects invalid provider output without changing the saved plan', async () => {
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async (_input: GenerateDailyPlanInput) => {
              throw new Error('Not used by this test.');
            },
            generatePlanCheckpointProposal: async (
              _input: GeneratePlanCheckpointProposalInput
            ) => ({ invalid: true })
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app);
      const plan = await createPlan(
        user.user.id,
        createBaseline(480),
        customCtx.prisma
      );
      await createLowSleepSnapshot(customCtx, user.user.id, plan.planLocalDate);

      const response = await request(customCtx.app.getHttpServer())
        .post(`/v1/daily-plans/${plan.id}/checkpoint/propose`)
        .set(authHeader(user.accessToken))
        .send({ trigger: 'HEALTH_SYNC' })
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'INVALID',
        proposal: null,
        failureReason: 'schema_validation_failed'
      });
      const saved = await customCtx.prisma.dailyPlan.findUniqueOrThrow({
        where: { id: plan.id }
      });
      expect(saved.planJson).toEqual(plan.planJson);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('rejects a SafetyAgent-blocked proposal without changing the saved plan', async () => {
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async (_input: GenerateDailyPlanInput) => {
              throw new Error('Not used by this test.');
            },
            generatePlanCheckpointProposal: async (
              input: GeneratePlanCheckpointProposalInput
            ) => input.currentPlan
          }
        },
        {
          token: SAFETY_AGENT_CONFIG,
          value: { enabled: true, provider: 'mock' }
        },
        {
          token: SAFETY_AGENT,
          value: {
            reviewDailyPlan: async () => ({
              approved: false,
              riskLevel: 'medium',
              reasons: ['The proposal needs a safer recovery adjustment.'],
              requiredChanges: ['Reduce the training recommendation.']
            })
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app);
      const plan = await createPlan(
        user.user.id,
        createBaseline(480),
        customCtx.prisma
      );
      await createLowSleepSnapshot(customCtx, user.user.id, plan.planLocalDate);

      const response = await request(customCtx.app.getHttpServer())
        .post(`/v1/daily-plans/${plan.id}/checkpoint/propose`)
        .set(authHeader(user.accessToken))
        .send({ trigger: 'HEALTH_SYNC' })
        .expect(201);

      expect(response.body).toMatchObject({
        status: 'UNSAFE',
        proposal: null,
        failureReason: 'safety_agent_rejected'
      });
      const saved = await customCtx.prisma.dailyPlan.findUniqueOrThrow({
        where: { id: plan.id }
      });
      expect(saved.planJson).toEqual(plan.planJson);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('does not allow another user to evaluate the plan', async () => {
    const owner = await registerTestUser(ctx.app);
    const otherUser = await registerTestUser(ctx.app);
    const plan = await createPlan(owner.user.id, createBaseline(480));

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.id}/checkpoint/evaluate`)
      .set(authHeader(otherUser.accessToken))
      .send({ trigger: 'APP_OPEN' })
      .expect(404);
  });

  async function createPlan(
    userId: string,
    checkpointBaseline?: PlanCheckpointFacts,
    prisma = ctx.prisma
  ) {
    const planJson = {
      ...createSafeFallbackPlan({
        planLocalDate: '2026-07-26',
        planTimezone: 'UTC'
      }),
      ...(checkpointBaseline ? { checkpointBaseline } : {})
    };

    return prisma.dailyPlan.create({
      data: {
        userId,
        planLocalDate: '2026-07-26',
        planTimezone: 'UTC',
        status: PlanStatus.READY,
        readinessLevel: DailyReadinessLevel.MAINTAIN,
        planJson: planJson as unknown as Prisma.JsonObject
      }
    });
  }

  async function createLowSleepSnapshot(
    testContext: TestApp,
    userId: string,
    planLocalDate: string
  ) {
    return testContext.prisma.wearableDailySnapshot.create({
      data: {
        userId,
        source: HealthProvider.APPLE_HEALTH,
        localDate: planLocalDate,
        timezone: 'UTC',
        sleepMinutes: 300,
        capturedAt: new Date('2026-07-26T10:00:00.000Z')
      }
    });
  }
});

function createBaseline(sleepMinutes: number): PlanCheckpointFacts {
  return {
    capturedAt: '2026-07-26T08:00:00.000Z',
    health: {
      source: 'APPLE_HEALTH',
      localDate: '2026-07-26',
      sleepMinutes,
      steps: 1000,
      activeCaloriesKcal: 100,
      workoutMinutes: 0
    },
    progress: {
      completedMeals: 0,
      skippedMeals: 0,
      workoutStatus: 'NOT_STARTED'
    },
    checkIn: {
      energyLevel: null,
      tirednessLevel: null,
      sorenessLevel: null
    },
    safetySignals: {
      painOrLimitation: false,
      illness: false,
      dizziness: false,
      exhaustion: false
    }
  };
}
