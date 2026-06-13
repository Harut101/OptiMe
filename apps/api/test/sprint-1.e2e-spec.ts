import request from 'supertest';
import {
  AiOperationFeature,
  AiOperationProvider,
  AiOperationStatus,
  DailyCheckInType,
  GoalType,
  PlanQualityMode,
  PregnancyStatus,
  ProgressiveProfilePromptKey,
  ProgressiveProfilePromptStatus,
  SubscriptionEnvironment,
  SubscriptionPlan,
  SubscriptionProvider,
  SubscriptionStatus,
  TargetMuscleGroup,
  TrainingEquipment,
  TrainingLevel,
  TrainingOutcome,
  UsageFeature,
  UsagePeriodType
} from '@prisma/client';

import { AiOperationLogsService } from '../src/modules/ai-operation-logs/ai-operation-logs.service';
import { GenerateDailyPlanInput } from '../src/modules/ai/ai-provider.interface';
import { AI_PROVIDER } from '../src/modules/ai/ai-provider.token';
import { OPENAI_CLIENT_FACTORY } from '../src/modules/ai/open-ai-client.factory';
import { normalizeDailyPlanFoodNames } from '../src/modules/daily-plans/daily-plan-food-name-normalizer';
import { dailyPlanJsonSchema } from '../src/modules/daily-plans/daily-plan-json.schema';
import { createMockDailyPlan } from '../src/modules/daily-plans/templates/mock-daily-plan.factory';
import { FeatureAccessService } from '../src/modules/entitlements/feature-access.service';
import { ProtocolSelectorService } from '../src/modules/protocol/protocol-selector.service';
import { ProtocolSelectionInput } from '../src/modules/protocol/protocol.types';
import { SafetyService } from '../src/modules/safety/safety.service';
import { SafetyAgent } from '../src/modules/safety-agent/safety-agent.interface';
import { safetyAgentReviewSchema } from '../src/modules/safety-agent/safety-agent-review.schema';
import {
  SAFETY_AGENT,
  SAFETY_AGENT_CONFIG,
  SafetyAgentConfig
} from '../src/modules/safety-agent/safety-agent.token';
import { UsageGuardService } from '../src/modules/usage/usage-guard.service';
import { UsageLedgerService } from '../src/modules/usage/usage-ledger.service';
import { UsageLimitExceededException } from '../src/modules/usage/usage-limit-exceeded.exception';
import { cleanupDatabase } from './helpers/cleanup';
import { authHeader, registerTestUser } from './helpers/auth';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Sprint 1 backend vertical slice', () => {
  let ctx: TestApp;
  const originalAiProvider = process.env.AI_PROVIDER;
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalOpenAiDefaultModel = process.env.OPENAI_DEFAULT_MODEL;
  const originalOpenAiRequestTimeoutMs = process.env.OPENAI_REQUEST_TIMEOUT_MS;
  const originalOpenAiMaxOutputTokens = process.env.OPENAI_MAX_OUTPUT_TOKENS;
  const originalSafetyAgentEnabled = process.env.SAFETY_AGENT_ENABLED;
  const originalSafetyAgentProvider = process.env.SAFETY_AGENT_PROVIDER;

  beforeAll(async () => {
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.SAFETY_AGENT_ENABLED;
    delete process.env.SAFETY_AGENT_PROVIDER;
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

    restoreOpenAiEnv(
      originalAiProvider,
      originalOpenAiApiKey,
      originalOpenAiDefaultModel,
      originalOpenAiRequestTimeoutMs,
      originalOpenAiMaxOutputTokens
    );
    restoreSafetyAgentEnv(originalSafetyAgentEnabled, originalSafetyAgentProvider);
  });

  it('registers, logs in, and returns the authenticated user without passwordHash', async () => {
    const registered = await registerTestUser(ctx.app);

    expect(registered.accessToken).toBeTruthy();
    expect(registered.user.passwordHash).toBeUndefined();

    const login = await request(ctx.app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: registered.email,
        password: 'password123'
      })
      .expect(201);

    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.user.passwordHash).toBeUndefined();

    const me = await request(ctx.app.getHttpServer())
      .get('/v1/me')
      .set(authHeader(login.body.accessToken))
      .expect(200);

    expect(me.body.email).toBe(registered.email);
    expect(me.body.passwordHash).toBeUndefined();
  });

  it('requires auth for entitlement summary', async () => {
    await request(ctx.app.getHttpServer()).get('/v1/me/entitlements').expect(401);
  });

  it('resolves no subscription to FREE and BASIC entitlement summary', async () => {
    const user = await registerTestUser(ctx.app);

    const entitlements = await request(ctx.app.getHttpServer())
      .get('/v1/me/entitlements')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(entitlements.body).toEqual({
      currentPlan: 'FREE',
      planQualityMode: 'BASIC',
      isPremium: false,
      source: 'default_free',
      features: expectedFeaturesForPlan('FREE')
    });
  });

  it.each([
    [SubscriptionPlan.PLUS, 'PERSONALIZED'],
    [SubscriptionPlan.PRO, 'ADAPTIVE']
  ])('resolves active %s subscription to the expected entitlement summary', async (plan, mode) => {
    const user = await registerTestUser(ctx.app);
    const subscription = await createTestSubscription(ctx, user.user.id, {
      plan,
      status: SubscriptionStatus.ACTIVE
    });

    const entitlements = await request(ctx.app.getHttpServer())
      .get('/v1/me/entitlements')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(entitlements.body).toEqual({
      currentPlan: plan,
      planQualityMode: mode,
      isPremium: true,
      activeSubscriptionId: subscription.id,
      source: 'subscription',
      features: expectedFeaturesForPlan(plan)
    });
  });

  it('resolves expired subscription to FREE and BASIC', async () => {
    const user = await registerTestUser(ctx.app);
    await createTestSubscription(ctx, user.user.id, {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.EXPIRED,
      startsAt: daysFromNow(-30),
      expiresAt: daysFromNow(-1)
    });

    const entitlements = await request(ctx.app.getHttpServer())
      .get('/v1/me/entitlements')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(entitlements.body).toMatchObject({
      currentPlan: 'FREE',
      planQualityMode: 'BASIC',
      isPremium: false,
      source: 'default_free',
      features: expectedFeaturesForPlan('FREE')
    });
    expect(entitlements.body.activeSubscriptionId).toBeUndefined();
  });

  it('keeps canceled subscription active until expiresAt', async () => {
    const user = await registerTestUser(ctx.app);
    const subscription = await createTestSubscription(ctx, user.user.id, {
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.CANCELED,
      startsAt: daysFromNow(-30),
      expiresAt: daysFromNow(5),
      canceledAt: daysFromNow(-1)
    });

    const entitlements = await request(ctx.app.getHttpServer())
      .get('/v1/me/entitlements')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(entitlements.body).toMatchObject({
      currentPlan: 'PLUS',
      planQualityMode: 'PERSONALIZED',
      isPremium: true,
      activeSubscriptionId: subscription.id,
      source: 'subscription',
      features: expectedFeaturesForPlan('PLUS')
    });
  });

  it('resolves canceled subscription after expiresAt to FREE', async () => {
    const user = await registerTestUser(ctx.app);
    await createTestSubscription(ctx, user.user.id, {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.CANCELED,
      startsAt: daysFromNow(-30),
      expiresAt: daysFromNow(-1),
      canceledAt: daysFromNow(-2)
    });

    const entitlements = await request(ctx.app.getHttpServer())
      .get('/v1/me/entitlements')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(entitlements.body).toMatchObject({
      currentPlan: 'FREE',
      planQualityMode: 'BASIC',
      isPremium: false,
      source: 'default_free',
      features: expectedFeaturesForPlan('FREE')
    });
  });

  it('resolves overlapping PLUS and PRO subscriptions to PRO', async () => {
    const user = await registerTestUser(ctx.app);
    await createTestSubscription(ctx, user.user.id, {
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE,
      startsAt: daysFromNow(-20),
      expiresAt: daysFromNow(10)
    });
    const proSubscription = await createTestSubscription(ctx, user.user.id, {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
      startsAt: daysFromNow(-10),
      expiresAt: daysFromNow(20)
    });

    const entitlements = await request(ctx.app.getHttpServer())
      .get('/v1/me/entitlements')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(entitlements.body).toMatchObject({
      currentPlan: 'PRO',
      planQualityMode: 'ADAPTIVE',
      isPremium: true,
      activeSubscriptionId: proSubscription.id,
      source: 'subscription',
      features: expectedFeaturesForPlan('PRO')
    });
  });

  it('treats PAST_DUE subscription as FREE for now', async () => {
    const user = await registerTestUser(ctx.app);
    await createTestSubscription(ctx, user.user.id, {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.PAST_DUE,
      startsAt: daysFromNow(-10),
      expiresAt: daysFromNow(20)
    });

    const entitlements = await request(ctx.app.getHttpServer())
      .get('/v1/me/entitlements')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(entitlements.body).toMatchObject({
      currentPlan: 'FREE',
      planQualityMode: 'BASIC',
      isPremium: false,
      source: 'default_free',
      features: expectedFeaturesForPlan('FREE')
    });
  });

  it('does not let client input influence entitlement response', async () => {
    const user = await registerTestUser(ctx.app);

    const entitlements = await request(ctx.app.getHttpServer())
      .get('/v1/me/entitlements?currentPlan=PRO&planQualityMode=ADAPTIVE')
      .set(authHeader(user.accessToken))
      .send({
        currentPlan: 'PRO',
        planQualityMode: 'ADAPTIVE',
        activeSubscriptionId: 'client-controlled'
      })
      .expect(200);

    expect(entitlements.body).toEqual({
      currentPlan: 'FREE',
      planQualityMode: 'BASIC',
      isPremium: false,
      source: 'default_free',
      features: expectedFeaturesForPlan('FREE')
    });
  });

  it('FeatureAccessService resolves plan quality modes and feature flags by tier', async () => {
    const featureAccess = ctx.app.get(FeatureAccessService);
    const freeUser = await registerTestUser(ctx.app, 'feature-free@example.com');
    const plusUser = await registerTestUser(ctx.app, 'feature-plus@example.com');
    const proUser = await registerTestUser(ctx.app, 'feature-pro@example.com');

    await createTestSubscription(ctx, plusUser.user.id, {
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE
    });
    await createTestSubscription(ctx, proUser.user.id, {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE
    });

    await expect(featureAccess.getPlanQualityMode(freeUser.user.id)).resolves.toBe(
      PlanQualityMode.BASIC
    );
    await expect(featureAccess.getPlanQualityMode(plusUser.user.id)).resolves.toBe(
      PlanQualityMode.PERSONALIZED
    );
    await expect(featureAccess.getPlanQualityMode(proUser.user.id)).resolves.toBe(
      PlanQualityMode.ADAPTIVE
    );

    await expect(featureAccess.canGenerateDailyPlan(freeUser.user.id)).resolves.toBe(true);
    await expect(featureAccess.canRefreshPlan(freeUser.user.id)).resolves.toBe(true);
    await expect(featureAccess.canUseOpenAIProvider(freeUser.user.id)).resolves.toBe(true);
    await expect(featureAccess.canUseAdvancedPersonalization(freeUser.user.id)).resolves.toBe(
      false
    );
    await expect(featureAccess.canUseFeedbackPersonalization(plusUser.user.id)).resolves.toBe(
      true
    );
    await expect(featureAccess.canUseWhoop(plusUser.user.id)).resolves.toBe(false);
    await expect(featureAccess.canUseWhoop(proUser.user.id)).resolves.toBe(true);
    await expect(featureAccess.canUseAiCoach(proUser.user.id)).resolves.toBe(true);
  });

  it('tracks usage with unique period rows and concurrency-safe increments', async () => {
    const user = await registerTestUser(ctx.app);
    const usageLedger = ctx.app.get(UsageLedgerService);
    const dailyPeriod = usageLedger.getPeriodStart(
      UsagePeriodType.DAILY,
      new Date('2026-06-06T22:00:00.000Z'),
      'Asia/Yerevan'
    );
    const monthlyPeriod = usageLedger.getPeriodStart(
      UsagePeriodType.MONTHLY,
      new Date('2026-06-20T12:00:00.000Z'),
      'UTC'
    );

    expect(dailyPeriod.toISOString()).toBe('2026-06-07T00:00:00.000Z');
    expect(monthlyPeriod.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    await expect(
      usageLedger.getUsage(
        user.user.id,
        UsageFeature.DAILY_PLAN_GENERATION,
        UsagePeriodType.DAILY
      )
    ).resolves.toBe(0);

    await usageLedger.incrementUsage(
      user.user.id,
      UsageFeature.DAILY_PLAN_GENERATION,
      UsagePeriodType.DAILY
    );
    await usageLedger.incrementUsage(
      user.user.id,
      UsageFeature.DAILY_PLAN_GENERATION,
      UsagePeriodType.DAILY,
      2
    );

    await Promise.all(
      Array.from({ length: 7 }, () =>
        usageLedger.incrementUsage(
          user.user.id,
          UsageFeature.DAILY_PLAN_GENERATION,
          UsagePeriodType.DAILY
        )
      )
    );

    const rows = await ctx.prisma.usageLedger.findMany({
      where: {
        userId: user.user.id,
        feature: UsageFeature.DAILY_PLAN_GENERATION,
        periodType: UsagePeriodType.DAILY
      }
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(10);
  });

  it('resolves usage limits by backend entitlements and never blocks safety tracking', async () => {
    const freeUser = await registerTestUser(ctx.app, 'usage-free@example.com');
    const plusUser = await registerTestUser(ctx.app, 'usage-plus@example.com');
    const proUser = await registerTestUser(ctx.app, 'usage-pro@example.com');
    const usageGuard = ctx.app.get(UsageGuardService);
    await createTestSubscription(ctx, plusUser.user.id, {
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE
    });
    await createTestSubscription(ctx, proUser.user.id, {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE
    });

    await expect(
      usageGuard.getLimit(
        freeUser.user.id,
        UsageFeature.DAILY_PLAN_GENERATION,
        UsagePeriodType.DAILY
      )
    ).resolves.toBe(1);
    await expect(
      usageGuard.getLimit(
        plusUser.user.id,
        UsageFeature.DAILY_PLAN_REFRESH,
        UsagePeriodType.DAILY
      )
    ).resolves.toBe(5);
    await expect(
      usageGuard.getLimit(
        proUser.user.id,
        UsageFeature.AI_DAILY_PLAN_GENERATION,
        UsagePeriodType.DAILY
      )
    ).resolves.toBe(20);
    await expect(
      usageGuard.getLimit(
        freeUser.user.id,
        UsageFeature.AI_SAFETY_AGENT_REVIEW,
        UsagePeriodType.DAILY
      )
    ).resolves.toBeNull();

    await usageGuard.assertCanUse(
      freeUser.user.id,
      UsageFeature.DAILY_PLAN_REFRESH,
      UsagePeriodType.DAILY
    );
    await usageGuard.consume(
      freeUser.user.id,
      UsageFeature.DAILY_PLAN_REFRESH,
      UsagePeriodType.DAILY
    );
    await expect(
      usageGuard.assertCanUse(
        freeUser.user.id,
        UsageFeature.DAILY_PLAN_REFRESH,
        UsagePeriodType.DAILY
      )
    ).rejects.toBeInstanceOf(UsageLimitExceededException);

    await usageGuard.checkAndConsume(
      freeUser.user.id,
      UsageFeature.AI_DAILY_PLAN_GENERATION,
      UsagePeriodType.DAILY
    );
    await expect(
      usageGuard.checkAndConsume(
        freeUser.user.id,
        UsageFeature.AI_DAILY_PLAN_GENERATION,
        UsagePeriodType.DAILY
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'USAGE_LIMIT_REACHED',
        feature: UsageFeature.AI_DAILY_PLAN_GENERATION,
        currentPlan: SubscriptionPlan.FREE,
        limit: 1,
        periodType: UsagePeriodType.DAILY,
        upgradeSuggestion: 'PLUS'
      })
    });

    await Promise.all(
      Array.from({ length: 3 }, () =>
        usageGuard.checkAndConsume(
          freeUser.user.id,
          UsageFeature.AI_SAFETY_AGENT_REVIEW,
          UsagePeriodType.DAILY
        )
      )
    );
    await expect(
      usageGuard.getRemaining(
        freeUser.user.id,
        UsageFeature.AI_SAFETY_AGENT_REVIEW,
        UsagePeriodType.DAILY
      )
    ).resolves.toBeNull();
  });

  it('returns authenticated usage summary without trusting client plan input', async () => {
    const user = await registerTestUser(ctx.app, 'usage-summary@example.com');

    await request(ctx.app.getHttpServer()).get('/v1/me/usage').expect(401);

    await ctx.app.get(UsageLedgerService).incrementUsage(
      user.user.id,
      UsageFeature.DAILY_PLAN_GENERATION,
      UsagePeriodType.DAILY
    );

    const summary = await request(ctx.app.getHttpServer())
      .get('/v1/me/usage?currentPlan=PRO')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(summary.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feature: UsageFeature.DAILY_PLAN_GENERATION,
          periodType: UsagePeriodType.DAILY,
          count: 1,
          limit: 1,
          remaining: 0
        }),
        expect.objectContaining({
          feature: UsageFeature.DAILY_PLAN_REFRESH,
          periodType: UsagePeriodType.DAILY,
          count: 0,
          limit: 1,
          remaining: 1
        })
      ])
    );
    expect(summary.body.items).toHaveLength(3);
    expect(summary.body.items[0].resetAt).toEqual(expect.any(String));
  });

  it('derives isMinor and safeMode from dateOfBirth and rejects client safeMode', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Minor',
        dateOfBirth: '2012-01-01',
        heightCm: 150,
        weightKg: 45,
        activityLevel: 'MODERATE',
        safeMode: false
      })
      .expect(400);

    const profile = await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Minor',
        dateOfBirth: '2012-01-01',
        heightCm: 150,
        weightKg: 45,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    expect(profile.body.user.isMinor).toBe(true);
    expect(profile.body.user.safeMode).toBe(true);
  });

  it('defaults pregnancyStatus to UNKNOWN and saves optional pregnancy-sensitive statuses', async () => {
    const user = await registerTestUser(ctx.app);

    const defaultProfile = await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Profile',
        dateOfBirth: '1990-01-01',
        heightCm: 170,
        weightKg: 70,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    expect(defaultProfile.body.profile.pregnancyStatus).toBe(PregnancyStatus.UNKNOWN);

    for (const status of [
      PregnancyStatus.PREGNANT,
      PregnancyStatus.POSTPARTUM,
      PregnancyStatus.BREASTFEEDING
    ]) {
      const response = await request(ctx.app.getHttpServer())
        .put('/v1/profile')
        .set(authHeader(user.accessToken))
        .send({
          firstName: 'Profile',
          gender: 'female',
          pregnancyStatus: status,
          dateOfBirth: '1990-01-01',
          heightCm: 170,
          weightKg: 70,
          activityLevel: 'MODERATE',
          privacyConsentAccepted: true
        })
        .expect(200);

      expect(response.body.profile.pregnancyStatus).toBe(status);
      expect(response.body.user.safeMode).toBe(false);
    }
  });

  it('saves goals, nutrition preferences, training schedule, and onboarding status', async () => {
    const user = await registerTestUser(ctx.app);

    await completeRequiredOnboarding(ctx.app, user.accessToken);

    const status = await request(ctx.app.getHttpServer())
      .get('/v1/onboarding/status')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(status.body).toMatchObject({
      profileCompleted: true,
      goalCompleted: true,
      nutritionPreferencesCompleted: true,
      trainingScheduleCompleted: true,
      privacyConsentCompleted: true,
      canGeneratePlan: true,
      stage1Completed: true,
      canGenerateFirstPlan: true,
      missingStage1Fields: []
    });
    expect(status.body.progressiveProfile.completedPrompts).toEqual(
      expect.arrayContaining([
        ProgressiveProfilePromptKey.PREFERRED_FOODS,
        ProgressiveProfilePromptKey.EXCLUDED_FOODS,
        ProgressiveProfilePromptKey.MEALS_PER_DAY
      ])
    );
  });

  it('reports Stage 1 readiness separately from progressive profile completion', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'StageOne',
        gender: 'female',
        pregnancyStatus: PregnancyStatus.UNKNOWN,
        dateOfBirth: '1990-01-01',
        heightCm: 170,
        weightKg: 70,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({ goalType: 'IMPROVE_FITNESS' })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/nutrition-preferences')
      .set(authHeader(user.accessToken))
      .send({ noKnownAllergiesConfirmed: true })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .put('/v1/training-schedule/intent')
      .set(authHeader(user.accessToken))
      .send({ noTrainingPlanned: true })
      .expect(200);

    const status = await request(ctx.app.getHttpServer())
      .get('/v1/onboarding/status')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(status.body).toMatchObject({
      profileCompleted: true,
      goalCompleted: true,
      nutritionPreferencesCompleted: true,
      trainingScheduleCompleted: false,
      privacyConsentCompleted: true,
      canGeneratePlan: true,
      stage1Completed: true,
      canGenerateFirstPlan: true,
      missingStage1Fields: []
    });
    expect(status.body.progressiveProfile.completedPrompts).not.toContain(
      ProgressiveProfilePromptKey.PREFERRED_FOODS
    );
    expect(status.body.progressiveProfile.completedPrompts).not.toContain(
      ProgressiveProfilePromptKey.EXCLUDED_FOODS
    );
    expect(status.body.progressiveProfile.completedPrompts).not.toContain(
      ProgressiveProfilePromptKey.DIET_TYPE
    );
  });

  it('blocks Stage 1 when required safety basics are missing', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'MissingBasics',
        dateOfBirth: '1990-01-01',
        heightCm: 170,
        weightKg: 70,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const status = await request(ctx.app.getHttpServer())
      .get('/v1/onboarding/status')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(status.body.stage1Completed).toBe(false);
    expect(status.body.canGenerateFirstPlan).toBe(false);
    expect(status.body.missingStage1Fields).toEqual(
      expect.arrayContaining(['gender', 'goalType', 'allergyInformation', 'basicTrainingIntent'])
    );
  });

  it('blocks Stage 1 when date of birth has not been collected', async () => {
    const user = await registerTestUser(ctx.app);

    const status = await request(ctx.app.getHttpServer())
      .get('/v1/onboarding/status')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(status.body.stage1Completed).toBe(false);
    expect(status.body.missingStage1Fields).toContain('dateOfBirth');
  });

  it('blocks Stage 1 for an incomplete stored weight-loss goal', async () => {
    const user = await registerTestUser(ctx.app);
    await completeStage1BasicsWithoutGoal(ctx.app, user.accessToken);
    await ctx.prisma.goal.create({
      data: {
        userId: user.user.id,
        goalType: 'REDUCE_WEIGHT'
      }
    });

    const status = await request(ctx.app.getHttpServer())
      .get('/v1/onboarding/status')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(status.body.stage1Completed).toBe(false);
    expect(status.body.missingStage1Fields).toEqual(
      expect.arrayContaining(['targetWeightKg', 'targetTimelineDays', 'impactMode'])
    );
  });

  it('keeps Stage 1 complete when pregnancy status is unknown', async () => {
    const user = await registerTestUser(ctx.app);

    await completeRequiredOnboarding(ctx.app, user.accessToken, 'PregnancyUnknown');

    const status = await request(ctx.app.getHttpServer())
      .get('/v1/onboarding/status')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(status.body.stage1Completed).toBe(true);
    expect(status.body.canGenerateFirstPlan).toBe(true);
  });

  it('allows daily plan generation with Stage 1 basics and deferred personalization fields', async () => {
    const user = await registerTestUser(ctx.app);
    await completeStage1BasicsWithoutGoal(ctx.app, user.accessToken, 'MinimalPlan');

    await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({ goalType: 'IMPROVE_FITNESS' })
      .expect(200);

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);

    expect(plan.body.status).toBe('READY');
    expect(plan.body.plan.nutrition.meals.length).toBeGreaterThan(0);
  });

  it('requires auth for progressive profile next prompt', async () => {
    await request(ctx.app.getHttpServer()).get('/v1/progressive-profile/next-prompt').expect(401);
  });

  it('returns the first available progressive prompt and stores it as pending', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'PromptStart');

    const prompt = await request(ctx.app.getHttpServer())
      .get('/v1/progressive-profile/next-prompt')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(prompt.body).toMatchObject({
      key: ProgressiveProfilePromptKey.LIMITATIONS_OR_PAIN_AREAS,
      inputType: 'stringList'
    });

    const stored = await ctx.prisma.userProgressiveProfilePrompt.findUniqueOrThrow({
      where: {
        userId_promptKey: {
          userId: user.user.id,
          promptKey: ProgressiveProfilePromptKey.LIMITATIONS_OR_PAIN_AREAS
        }
      }
    });

    expect(stored.status).toBe(ProgressiveProfilePromptStatus.PENDING);
  });

  it('answers preferred and excluded food prompts and does not return them again', async () => {
    const user = await registerTestUser(ctx.app);
    await completeStage1BasicsWithoutGoal(ctx.app, user.accessToken, 'PromptFoods');

    await request(ctx.app.getHttpServer())
      .post(`/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.EXCLUDED_FOODS}/answer`)
      .set(authHeader(user.accessToken))
      .send({ value: ['pork', 'anchovies'] })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post(`/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.PREFERRED_FOODS}/answer`)
      .set(authHeader(user.accessToken))
      .send({ value: 'berries, oats' })
      .expect(201);

    const preference = await ctx.prisma.nutritionPreference.findUniqueOrThrow({
      where: { userId: user.user.id },
      include: {
        preferredFoods: true,
        excludedFoods: true
      }
    });

    expect(preference.excludedFoods.map((food) => food.name)).toEqual(
      expect.arrayContaining(['pork', 'anchovies'])
    );
    expect(preference.preferredFoods.map((food) => food.name)).toEqual(
      expect.arrayContaining(['berries', 'oats'])
    );

    const nextPrompt = await request(ctx.app.getHttpServer())
      .get('/v1/progressive-profile/next-prompt')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(nextPrompt.body.key).not.toBe(ProgressiveProfilePromptKey.EXCLUDED_FOODS);
    expect(nextPrompt.body.key).not.toBe(ProgressiveProfilePromptKey.PREFERRED_FOODS);
  });

  it('skips a progressive prompt with cooldown so it does not immediately reappear', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'PromptSkip');

    const skipped = await request(ctx.app.getHttpServer())
      .post(
        `/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.LIMITATIONS_OR_PAIN_AREAS}/skip`
      )
      .set(authHeader(user.accessToken))
      .expect(201);

    expect(skipped.body.skipped).toBe(true);
    expect(new Date(skipped.body.skippedUntil).getTime()).toBeGreaterThan(Date.now());

    const nextPrompt = await request(ctx.app.getHttpServer())
      .get('/v1/progressive-profile/next-prompt')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(nextPrompt.body.key).not.toBe(ProgressiveProfilePromptKey.LIMITATIONS_OR_PAIN_AREAS);
  });

  it('validates prompt keys and answers safely', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .post('/v1/progressive-profile/prompts/NOT_A_PROMPT/answer')
      .set(authHeader(user.accessToken))
      .send({ value: 'test' })
      .expect(404);

    await request(ctx.app.getHttpServer())
      .post(`/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.TRAINING_LEVEL}/answer`)
      .set(authHeader(user.accessToken))
      .send({ value: 'ELITE' })
      .expect(400);
  });

  it('keeps progressive prompt answers scoped to the current user', async () => {
    const firstUser = await registerTestUser(ctx.app, 'progressive-one@example.com');
    const secondUser = await registerTestUser(ctx.app, 'progressive-two@example.com');

    await request(ctx.app.getHttpServer())
      .post(`/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.EQUIPMENT}/answer`)
      .set(authHeader(firstUser.accessToken))
      .send({ value: ['DUMBBELLS'] })
      .expect(201);

    const firstPrompt = await ctx.prisma.userProgressiveProfilePrompt.findUnique({
      where: {
        userId_promptKey: {
          userId: firstUser.user.id,
          promptKey: ProgressiveProfilePromptKey.EQUIPMENT
        }
      }
    });
    const secondPrompt = await ctx.prisma.userProgressiveProfilePrompt.findUnique({
      where: {
        userId_promptKey: {
          userId: secondUser.user.id,
          promptKey: ProgressiveProfilePromptKey.EQUIPMENT
        }
      }
    });

    expect(firstPrompt?.status).toBe(ProgressiveProfilePromptStatus.ANSWERED);
    expect(secondPrompt).toBeNull();
  });

  it('requires auth for training preferences', async () => {
    await request(ctx.app.getHttpServer()).get('/v1/training-preferences').expect(401);
  });

  it('returns empty training preference defaults when none exist', async () => {
    const user = await registerTestUser(ctx.app, 'training-pref-empty@example.com');

    const response = await request(ctx.app.getHttpServer())
      .get('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(response.body).toEqual({
      targetMuscleGroups: [],
      trainingOutcome: null,
      equipment: [],
      trainingLevel: null,
      limitationsOrPainAreas: [],
      preferredTrainingDays: []
    });
  });

  it('creates and updates optional training preferences', async () => {
    const user = await registerTestUser(ctx.app, 'training-pref-upsert@example.com');

    const created = await request(ctx.app.getHttpServer())
      .put('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .send({
        targetMuscleGroups: [TargetMuscleGroup.CORE, TargetMuscleGroup.LEGS],
        trainingOutcome: TrainingOutcome.STRENGTH,
        equipment: [TrainingEquipment.DUMBBELLS, TrainingEquipment.BODYWEIGHT],
        trainingLevel: TrainingLevel.BEGINNER,
        limitationsOrPainAreas: ['knee discomfort'],
        preferredTrainingDays: [1, 3, 5]
      })
      .expect(200);

    expect(created.body).toMatchObject({
      targetMuscleGroups: [TargetMuscleGroup.CORE, TargetMuscleGroup.LEGS],
      trainingOutcome: TrainingOutcome.STRENGTH,
      equipment: [TrainingEquipment.DUMBBELLS, TrainingEquipment.BODYWEIGHT],
      trainingLevel: TrainingLevel.BEGINNER,
      limitationsOrPainAreas: ['knee discomfort'],
      preferredTrainingDays: [1, 3, 5]
    });

    const updated = await request(ctx.app.getHttpServer())
      .put('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .send({
        trainingLevel: TrainingLevel.INTERMEDIATE,
        preferredTrainingDays: []
      })
      .expect(200);

    expect(updated.body.trainingLevel).toBe(TrainingLevel.INTERMEDIATE);
    expect(updated.body.preferredTrainingDays).toEqual([]);
    expect(updated.body.targetMuscleGroups).toEqual([
      TargetMuscleGroup.CORE,
      TargetMuscleGroup.LEGS
    ]);
  });

  it('validates training preference enum values and preferred training days', async () => {
    const user = await registerTestUser(ctx.app, 'training-pref-validation@example.com');

    await request(ctx.app.getHttpServer())
      .put('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .send({ targetMuscleGroups: ['NOT_A_MUSCLE'] })
      .expect(400);

    await request(ctx.app.getHttpServer())
      .put('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .send({ equipment: ['ROCKET_SHOES'] })
      .expect(400);

    await request(ctx.app.getHttpServer())
      .put('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .send({ trainingLevel: 'ELITE' })
      .expect(400);

    await request(ctx.app.getHttpServer())
      .put('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .send({ preferredTrainingDays: [0, 7] })
      .expect(400);
  });

  it('limits limitations or pain areas length', async () => {
    const user = await registerTestUser(ctx.app, 'training-pref-limitations@example.com');

    await request(ctx.app.getHttpServer())
      .put('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .send({ limitationsOrPainAreas: Array.from({ length: 21 }, (_, index) => `area-${index}`) })
      .expect(400);

    await request(ctx.app.getHttpServer())
      .put('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .send({ limitationsOrPainAreas: ['x'.repeat(121)] })
      .expect(400);
  });

  it('keeps training preferences scoped to the authenticated user', async () => {
    const firstUser = await registerTestUser(ctx.app, 'training-pref-one@example.com');
    const secondUser = await registerTestUser(ctx.app, 'training-pref-two@example.com');

    await request(ctx.app.getHttpServer())
      .put('/v1/training-preferences')
      .set(authHeader(firstUser.accessToken))
      .send({
        targetMuscleGroups: [TargetMuscleGroup.BACK],
        equipment: [TrainingEquipment.GYM]
      })
      .expect(200);

    const secondResponse = await request(ctx.app.getHttpServer())
      .get('/v1/training-preferences')
      .set(authHeader(secondUser.accessToken))
      .expect(200);

    expect(secondResponse.body.targetMuscleGroups).toEqual([]);
    expect(secondResponse.body.equipment).toEqual([]);
  });

  it('saves training preferences from progressive prompts', async () => {
    const user = await registerTestUser(ctx.app, 'training-pref-prompts@example.com');

    await request(ctx.app.getHttpServer())
      .post(`/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.TARGET_MUSCLE_GROUPS}/answer`)
      .set(authHeader(user.accessToken))
      .send({ value: [TargetMuscleGroup.CORE, TargetMuscleGroup.GLUTES] })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post(`/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.EQUIPMENT}/answer`)
      .set(authHeader(user.accessToken))
      .send({ value: [TrainingEquipment.HOME, TrainingEquipment.BODYWEIGHT] })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post(`/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.TRAINING_LEVEL}/answer`)
      .set(authHeader(user.accessToken))
      .send({ value: TrainingLevel.BEGINNER })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post(`/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.LIMITATIONS_OR_PAIN_AREAS}/answer`)
      .set(authHeader(user.accessToken))
      .send({ value: ['shoulder discomfort'] })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post(`/v1/progressive-profile/prompts/${ProgressiveProfilePromptKey.TRAINING_OUTCOME}/answer`)
      .set(authHeader(user.accessToken))
      .send({ value: TrainingOutcome.MOBILITY })
      .expect(201);

    const response = await request(ctx.app.getHttpServer())
      .get('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(response.body).toMatchObject({
      targetMuscleGroups: [TargetMuscleGroup.CORE, TargetMuscleGroup.GLUTES],
      equipment: [TrainingEquipment.HOME, TrainingEquipment.BODYWEIGHT],
      trainingLevel: TrainingLevel.BEGINNER,
      limitationsOrPainAreas: ['shoulder discomfort'],
      trainingOutcome: TrainingOutcome.MOBILITY
    });
  });

  it('does not block first plan generation when training preferences are missing', async () => {
    const user = await registerTestUser(ctx.app, 'training-pref-optional@example.com');
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'TrainingOptional');

    const status = await request(ctx.app.getHttpServer())
      .get('/v1/onboarding/status')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(status.body.canGenerateFirstPlan).toBe(true);

    const preferences = await request(ctx.app.getHttpServer())
      .get('/v1/training-preferences')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(preferences.body).toMatchObject({
      targetMuscleGroups: [],
      equipment: [],
      limitationsOrPainAreas: []
    });
  });

  it('adds training preferences to daily plan personalization context when available', async () => {
    const capturedInputs: GenerateDailyPlanInput[] = [];
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async (input: GenerateDailyPlanInput) => {
              capturedInputs.push(input);
              return createMockDailyPlan({
                firstName: input.user.firstName,
                isMinor: input.user.isMinor,
                planLocalDate: input.planLocalDate,
                planTimezone: input.planTimezone,
                planQualityMode: input.planQualityMode
              });
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'training-pref-context@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'TrainingContext');

      await request(customCtx.app.getHttpServer())
        .put('/v1/training-preferences')
        .set(authHeader(user.accessToken))
        .send({
          targetMuscleGroups: [TargetMuscleGroup.FULL_BODY],
          trainingOutcome: TrainingOutcome.GENERAL_FITNESS,
          equipment: [TrainingEquipment.BODYWEIGHT],
          trainingLevel: TrainingLevel.BEGINNER,
          limitationsOrPainAreas: ['ankle discomfort']
        })
        .expect(200);

      await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(capturedInputs[0]?.personalizationContext.trainingPreference).toMatchObject({
        targetMuscleGroups: [TargetMuscleGroup.FULL_BODY],
        trainingOutcome: TrainingOutcome.GENERAL_FITNESS,
        equipment: [TrainingEquipment.BODYWEIGHT],
        trainingLevel: TrainingLevel.BEGINNER,
        limitationsOrPainAreas: ['ankle discomfort'],
        limitationsAreSafetySensitive: true
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('selects deterministic protocols from safety, goal, training preference, and check-in context', () => {
    const selector = ctx.app.get(ProtocolSelectorService);

    expect(
      selector.select(baseProtocolInput({ isMinor: true, safeMode: true })).nutritionProtocol.id
    ).toBe('UNDER_18_SAFE');

    expect(
      selector.select(
        baseProtocolInput({
          profile: { pregnancyStatus: PregnancyStatus.PREGNANT }
        })
      )
    ).toMatchObject({
      nutritionProtocol: { id: 'PREGNANCY_POSTPARTUM_SAFE' },
      recoveryProtocol: { id: 'PREGNANCY_POSTPARTUM_CONSERVATIVE' }
    });

    expect(
      selector.select(
        baseProtocolInput({
          trainingPreference: {
            trainingOutcome: TrainingOutcome.GENERAL_FITNESS,
            equipment: [],
            trainingLevel: null,
            limitationsOrPainAreas: ['knee discomfort']
          }
        })
      )
    ).toMatchObject({
      trainingProtocol: { id: 'CONSERVATIVE_PAIN_LIMITATION' },
      recoveryProtocol: { id: 'PAIN_OR_DISCOMFORT' }
    });

    expect(
      selector.select(
        baseProtocolInput({
          checkInSummary: {
            recentAverageTiredness: 2,
            painOrDiscomfortReported: true,
            highTirednessReported: false,
            conservativeTrainingRecommended: true
          }
        })
      ).trainingProtocol.id
    ).toBe('CONSERVATIVE_PAIN_LIMITATION');

    expect(
      selector.select(
        baseProtocolInput({
          checkInSummary: {
            recentAverageTiredness: 5,
            painOrDiscomfortReported: false,
            highTirednessReported: true,
            conservativeTrainingRecommended: false
          }
        })
      )
    ).toMatchObject({
      nutritionProtocol: { id: 'RECOVERY_DAY' },
      trainingProtocol: { id: 'RECOVERY' },
      recoveryProtocol: { id: 'HIGH_TIREDNESS' }
    });

    expect(
      selector.select(baseProtocolInput({ noTrainingPlanned: true, trainingSchedule: [] }))
    ).toMatchObject({
      trainingProtocol: { id: 'NO_TRAINING_PLANNED' },
      recoveryProtocol: { id: 'REST_DAY' }
    });

    expect(
      selector.select(
        baseProtocolInput({
          goal: {
            goalType: GoalType.BUILD_MUSCLE,
            targetWeightKg: null,
            targetTimelineDays: null,
            impactMode: null
          },
          trainingPreference: {
            trainingOutcome: TrainingOutcome.MUSCLE_GROWTH,
            equipment: [TrainingEquipment.GYM],
            trainingLevel: TrainingLevel.INTERMEDIATE,
            limitationsOrPainAreas: []
          }
        })
      )
    ).toMatchObject({
      nutritionProtocol: { id: 'MUSCLE_GAIN' },
      trainingProtocol: { id: 'MUSCLE_GROWTH' }
    });

    expect(
      selector.select(
        baseProtocolInput({
          goal: {
            goalType: GoalType.REDUCE_WEIGHT,
            targetWeightKg: 75,
            targetTimelineDays: 90,
            impactMode: null
          }
        })
      ).nutritionProtocol.id
    ).toBe('SAFE_WEIGHT_LOSS');
  });

  it('uses PlanQualityMode for protocol detail reasons without changing safety protocol selection', () => {
    const selector = ctx.app.get(ProtocolSelectorService);
    const basic = selector.select(baseProtocolInput({ planQualityMode: PlanQualityMode.BASIC }));
    const adaptive = selector.select(baseProtocolInput({ planQualityMode: PlanQualityMode.ADAPTIVE }));

    expect(adaptive.nutritionProtocol.id).toBe(basic.nutritionProtocol.id);
    expect(adaptive.trainingProtocol.id).toBe(basic.trainingProtocol.id);
    expect(adaptive.recoveryProtocol.id).toBe(basic.recoveryProtocol.id);
    expect(basic.selectionReasons.some((reason) => reason.includes('PlanQualityMode BASIC'))).toBe(true);
    expect(adaptive.selectionReasons.some((reason) => reason.includes('PlanQualityMode ADAPTIVE'))).toBe(true);
  });

  it('passes selected protocols to AiProvider input and stores safe protocol debug IDs', async () => {
    const capturedInputs: GenerateDailyPlanInput[] = [];
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async (input: GenerateDailyPlanInput) => {
              capturedInputs.push(input);
              return createMockDailyPlan({
                firstName: input.user.firstName,
                isMinor: input.user.isMinor,
                planLocalDate: input.planLocalDate,
                planTimezone: input.planTimezone,
                planQualityMode: input.planQualityMode
              });
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'protocol-context@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'ProtocolContext');

      await request(customCtx.app.getHttpServer())
        .put('/v1/training-preferences')
        .set(authHeader(user.accessToken))
        .send({
          trainingOutcome: TrainingOutcome.MUSCLE_GROWTH,
          equipment: [TrainingEquipment.GYM],
          trainingLevel: TrainingLevel.INTERMEDIATE
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(capturedInputs[0]?.personalizationContext.selectedProtocols).toMatchObject({
        trainingProtocol: { id: 'MUSCLE_GROWTH' },
        recoveryProtocol: { id: 'NORMAL_RECOVERY' }
      });
      expect(plan.body.plan.debug.protocols).toEqual({
        nutritionProtocolId: 'MUSCLE_GAIN',
        trainingProtocolId: 'MUSCLE_GROWTH',
        recoveryProtocolId: 'NORMAL_RECOVERY'
      });
      expect(plan.body.plan.debug.protocols.nutritionProtocol).toBeUndefined();
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('supports training schedule CRUD for the authenticated user', async () => {
    const user = await registerTestUser(ctx.app);

    const created = await request(ctx.app.getHttpServer())
      .post('/v1/training-schedule/items')
      .set(authHeader(user.accessToken))
      .send({
        dayOfWeek: 1,
        localTime: '07:30',
        sportType: 'RUNNING',
        durationMinutes: 30,
        intensity: 'MODERATE',
        description: 'Easy run'
      })
      .expect(201);

    const listed = await request(ctx.app.getHttpServer())
      .get('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(listed.body).toHaveLength(1);

    const updated = await request(ctx.app.getHttpServer())
      .patch(`/v1/training-schedule/items/${created.body.id}`)
      .set(authHeader(user.accessToken))
      .send({ durationMinutes: 40 })
      .expect(200);

    expect(updated.body.durationMinutes).toBe(40);

    await request(ctx.app.getHttpServer())
      .delete(`/v1/training-schedule/items/${created.body.id}`)
      .set(authHeader(user.accessToken))
      .expect(200);

    const afterDelete = await request(ctx.app.getHttpServer())
      .get('/v1/training-schedule')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(afterDelete.body).toHaveLength(0);
  });

  it('persists mock daily plans and handles regeneration rules', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'First');

    const first = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);

    const stored = await ctx.prisma.dailyPlan.findUniqueOrThrow({
      where: {
        userId_planLocalDate_planTimezone: {
          userId: user.user.id,
          planLocalDate: first.body.planLocalDate,
          planTimezone: first.body.planTimezone
        }
      }
    });

    expect(stored.planJson).toBeTruthy();
    expect(first.body.id).toBe(stored.id);
    expect(dailyPlanJsonSchema.safeParse(first.body.plan).success).toBe(true);
    expect(first.body).toMatchObject({
      id: stored.id,
      status: 'READY',
      readinessLevel: 'MAINTAIN',
      planLocalDate: expect.any(String),
      planTimezone: expect.any(String),
      updatedAt: expect.any(String)
    });

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.id).toBe(first.body.id);
    expect(dailyPlanJsonSchema.safeParse(today.body.plan).success).toBe(true);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Second',
        dateOfBirth: '1990-01-01',
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const noRegenerate = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);

    expect(noRegenerate.body.id).toBe(first.body.id);
    expect(JSON.stringify(noRegenerate.body.plan)).toContain('First');

    const regenerated = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    expect(regenerated.body.id).toBe(first.body.id);
    expect(JSON.stringify(regenerated.body.plan)).toContain('Second');
  });

  it('consumes generation usage, keeps Today reads free, and blocks a second Free generation attempt', async () => {
    const user = await registerTestUser(ctx.app, 'usage-generation-integration@example.com');
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'UsageGenerate');

    const first = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);
    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);

    await expect(
      ctx.app.get(UsageLedgerService).getUsage(
        user.user.id,
        UsageFeature.DAILY_PLAN_GENERATION,
        UsagePeriodType.DAILY
      )
    ).resolves.toBe(1);

    await ctx.prisma.dailyPlan.delete({ where: { id: first.body.id } });
    const blocked = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(429);

    expect(blocked.body).toMatchObject({
      code: 'USAGE_LIMIT_REACHED',
      feature: UsageFeature.DAILY_PLAN_GENERATION,
      currentPlan: SubscriptionPlan.FREE,
      limit: 1,
      periodType: UsagePeriodType.DAILY,
      upgradeSuggestion: 'PLUS'
    });
  });

  it('consumes refresh usage and blocks a second Free refresh same day', async () => {
    const user = await registerTestUser(ctx.app, 'usage-refresh-integration@example.com');
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'RefreshOne');

    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'RefreshTwo',
        dateOfBirth: '1990-01-01',
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const blocked = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(429);

    expect(blocked.body).toMatchObject({
      code: 'USAGE_LIMIT_REACHED',
      feature: UsageFeature.DAILY_PLAN_REFRESH,
      currentPlan: SubscriptionPlan.FREE,
      limit: 1,
      periodType: UsagePeriodType.DAILY,
      upgradeSuggestion: 'PLUS'
    });
    await expect(
      ctx.app.get(UsageLedgerService).getUsage(
        user.user.id,
        UsageFeature.DAILY_PLAN_REFRESH,
        UsagePeriodType.DAILY
      )
    ).resolves.toBe(1);
  });

  it('allows Plus and Pro users to generate and refresh above Free limits', async () => {
    const plusUser = await registerTestUser(ctx.app, 'usage-plus-integration@example.com');
    const proUser = await registerTestUser(ctx.app, 'usage-pro-integration@example.com');
    await completeRequiredOnboarding(ctx.app, plusUser.accessToken, 'PlusUsage');
    await completeRequiredOnboarding(ctx.app, proUser.accessToken, 'ProUsage');
    await createTestSubscription(ctx, plusUser.user.id, {
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE
    });
    await createTestSubscription(ctx, proUser.user.id, {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE
    });

    for (const user of [plusUser, proUser]) {
      await request(ctx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: false })
        .expect(201);

      for (const name of ['RefreshA', 'RefreshB']) {
        await request(ctx.app.getHttpServer())
          .put('/v1/profile')
          .set(authHeader(user.accessToken))
          .send({
            firstName: name,
            dateOfBirth: '1990-01-01',
            heightCm: 180,
            weightKg: 80,
            activityLevel: 'MODERATE',
            privacyConsentAccepted: true
          })
          .expect(200);

        await request(ctx.app.getHttpServer())
          .post('/v1/daily-plans/generate')
          .set(authHeader(user.accessToken))
          .send({ forceRegenerate: true })
          .expect(201);
      }
    }
  });

  it('does not consume usage for auth failures, onboarding updates, or incomplete onboarding', async () => {
    const user = await registerTestUser(ctx.app, 'usage-no-count@example.com');

    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .send({ forceRegenerate: false })
      .expect(401);
    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'NoCount',
        dateOfBirth: '1990-01-01',
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);
    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(400);

    await expect(
      ctx.app.get(UsageLedgerService).getUsage(
        user.user.id,
        UsageFeature.DAILY_PLAN_GENERATION,
        UsagePeriodType.DAILY
      )
    ).resolves.toBe(0);
  });

  it('updates usage summary after generation and refresh', async () => {
    const user = await registerTestUser(ctx.app, 'usage-summary-after-actions@example.com');
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'UsageSummary');

    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: false })
      .expect(201);
    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const summary = await request(ctx.app.getHttpServer())
      .get('/v1/me/usage')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(summary.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feature: UsageFeature.DAILY_PLAN_GENERATION,
          count: 1,
          remaining: 0
        }),
        expect.objectContaining({
          feature: UsageFeature.DAILY_PLAN_REFRESH,
          count: 1,
          remaining: 0
        })
      ])
    );
  });

  it('returns menu option count by PlanQualityMode while keeping primary meals for mobile', async () => {
    const freeUser = await registerTestUser(ctx.app, 'menu-basic@example.com');
    const plusUser = await registerTestUser(ctx.app, 'menu-personalized@example.com');
    const proUser = await registerTestUser(ctx.app, 'menu-adaptive@example.com');

    await completeRequiredOnboarding(ctx.app, freeUser.accessToken, 'MenuBasic');
    await completeRequiredOnboarding(ctx.app, plusUser.accessToken, 'MenuPersonalized');
    await completeRequiredOnboarding(ctx.app, proUser.accessToken, 'MenuAdaptive');
    await createTestSubscription(ctx, plusUser.user.id, {
      plan: SubscriptionPlan.PLUS,
      status: SubscriptionStatus.ACTIVE
    });
    await createTestSubscription(ctx, proUser.user.id, {
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE
    });

    const usersAndExpectedCounts = [
      [freeUser, 1],
      [plusUser, 2],
      [proUser, 3]
    ] as const;

    for (const [user, expectedCount] of usersAndExpectedCounts) {
      const plan = await request(ctx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.plan.nutrition.meals.length).toBeGreaterThan(0);
      expect(plan.body.plan.nutrition.menuOptions).toHaveLength(expectedCount);
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    }
  });

  it('validates DailyPlanJson with optional text exercise recommendations', () => {
    const planWithoutExercises = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'NoExercises',
      isMinor: false
    });
    delete planWithoutExercises.training.exercises;

    expect(dailyPlanJsonSchema.safeParse(planWithoutExercises).success).toBe(true);

    const planWithExercises = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'WithExercises',
      isMinor: false,
      planQualityMode: PlanQualityMode.PERSONALIZED
    });

    expect(dailyPlanJsonSchema.safeParse(planWithExercises).success).toBe(true);
    expect(planWithExercises.training.exercises).toHaveLength(4);

    expect(
      dailyPlanJsonSchema.safeParse({
        ...planWithExercises,
        training: {
          ...planWithExercises.training,
          exercises: Array.from({ length: 9 }, (_, index) => ({
            name: `Exercise ${index}`,
            targetMuscles: ['full body'],
            equipment: ['bodyweight']
          }))
        }
      }).success
    ).toBe(false);

    expect(
      dailyPlanJsonSchema.safeParse({
        ...planWithExercises,
        training: {
          ...planWithExercises.training,
          exercises: [
            {
              name: ' ',
              targetMuscles: ['core'],
              equipment: ['bodyweight']
            }
          ]
        }
      }).success
    ).toBe(false);

    expect(
      dailyPlanJsonSchema.safeParse({
        ...planWithExercises,
        training: {
          ...planWithExercises.training,
          exercises: [
            {
              name: 'Bodyweight squat',
              targetMuscles: ['legs'],
              equipment: ['bodyweight'],
              safetyNotes: 'x'.repeat(221)
            }
          ]
        }
      }).success
    ).toBe(false);
  });

  it('varies mock exercise recommendation depth by PlanQualityMode', () => {
    expect(
      createMockDailyPlan({
        planLocalDate: getUtcLocalDate(),
        planTimezone: 'UTC',
        isMinor: false,
        planQualityMode: PlanQualityMode.BASIC
      }).training.exercises
    ).toHaveLength(2);
    expect(
      createMockDailyPlan({
        planLocalDate: getUtcLocalDate(),
        planTimezone: 'UTC',
        isMinor: false,
        planQualityMode: PlanQualityMode.PERSONALIZED
      }).training.exercises
    ).toHaveLength(4);
    expect(
      createMockDailyPlan({
        planLocalDate: getUtcLocalDate(),
        planTimezone: 'UTC',
        isMinor: false,
        planQualityMode: PlanQualityMode.ADAPTIVE
      }).training.exercises
    ).toHaveLength(5);
  });

  it('creates a safe AI operation log for successful mock daily plan generation', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'OperationLog');

    await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const logs = await ctx.prisma.aiOperationLog.findMany({
      where: { userId: user.user.id }
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: user.user.id,
      feature: AiOperationFeature.DAILY_PLAN,
      provider: AiOperationProvider.MOCK,
      model: null,
      status: AiOperationStatus.SUCCESS,
      retryCount: 0,
      safetyAgentEnabled: false,
      safetyAgentProvider: 'mock',
      safetyAgentApproved: null,
      fallbackReason: null,
      errorReason: null
    });
    expect(logs[0].latencyMs).toBeGreaterThanOrEqual(0);
    expect(logs[0]).not.toHaveProperty('prompt');
    expect(logs[0]).not.toHaveProperty('planJson');
    expect(logs[0]).not.toHaveProperty('profile');
    expect(logs[0]).not.toHaveProperty('passwordHash');
    expect(logs[0]).not.toHaveProperty('apiKey');
    expect(logs[0]).not.toHaveProperty('rawResponse');
  });

  it('records fallback reason in AI operation log for fallback generation', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'OperationFallback');

    await request(ctx.app.getHttpServer())
      .put('/v1/nutrition-preferences')
      .set(authHeader(user.accessToken))
      .send({
        dietType: 'NONE',
        mealsPerDay: 3,
        allergies: ['Greek yogurt'],
        excludedFoods: [],
        preferredFoods: ['rice']
      })
      .expect(200);

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const log = await ctx.prisma.aiOperationLog.findFirstOrThrow({
      where: { userId: user.user.id }
    });

    expect(plan.body.status).toBe('FALLBACK');
    expect(log.status).toBe(AiOperationStatus.FALLBACK);
    expect(log.fallbackReason).toContain('conflicts with your allergies');
    expect(log.errorReason).toBeNull();
  });

  it('does not break daily plan generation when AI operation logging fails', async () => {
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AiOperationLogsService,
          value: {
            record: async () => {
              throw new Error('Logging database unavailable');
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'operation-log-fails@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'LogFails');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('converts under-18 weight-loss goals to a safe wellness goal', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Young',
        dateOfBirth: '2012-01-01',
        heightCm: 150,
        weightKg: 50,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const goal = await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({
        goalType: 'REDUCE_WEIGHT',
        targetWeightKg: 45,
        targetTimelineDays: 30,
        impactMode: 'NUTRITION_AND_TRAINING'
      })
      .expect(200);

    expect(goal.body.goalType).toBe('HEALTHY_LIFESTYLE');
    expect(goal.body.targetWeightKg).toBeNull();
    expect(goal.body.targetTimelineDays).toBeNull();
    expect(goal.body.impactMode).toBeNull();
  });

  it('converts pregnancy-sensitive weight-loss goals to a safe wellness goal', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'PregnancySafe',
        gender: 'female',
        pregnancyStatus: PregnancyStatus.PREGNANT,
        dateOfBirth: '1990-01-01',
        heightCm: 170,
        weightKg: 90,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const goal = await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({
        goalType: 'REDUCE_WEIGHT',
        targetWeightKg: 85,
        targetTimelineDays: 60,
        impactMode: 'NUTRITION_AND_TRAINING'
      })
      .expect(200);

    expect(goal.body.goalType).toBe('HEALTHY_LIFESTYLE');
    expect(goal.body.targetWeightKg).toBeNull();
    expect(goal.body.targetTimelineDays).toBeNull();
    expect(goal.body.impactMode).toBeNull();
  });

  it('rejects aggressive adult weight-loss goals with supportive validation', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Adult',
        dateOfBirth: '1990-01-01',
        heightCm: 180,
        weightKg: 90,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const response = await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({
        goalType: 'REDUCE_WEIGHT',
        targetWeightKg: 80,
        targetTimelineDays: 60,
        impactMode: 'NUTRITION_AND_TRAINING'
      })
      .expect(400);

    expect(response.body.message).toContain('steadier goal');
    expect(response.body.message).not.toContain('fallbackReason');
    expect(response.body.message).not.toContain('safety_agent');
  });

  it('allows steady adult weight-loss goals within safety boundaries', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .put('/v1/profile')
      .set(authHeader(user.accessToken))
      .send({
        firstName: 'Adult',
        dateOfBirth: '1990-01-01',
        heightCm: 180,
        weightKg: 90,
        activityLevel: 'MODERATE',
        privacyConsentAccepted: true
      })
      .expect(200);

    const response = await request(ctx.app.getHttpServer())
      .put('/v1/goals')
      .set(authHeader(user.accessToken))
      .send({
        goalType: 'REDUCE_WEIGHT',
        targetWeightKg: 85,
        targetTimelineDays: 60,
        impactMode: 'NUTRITION_AND_TRAINING'
      })
      .expect(200);

    expect(response.body.goalType).toBe('REDUCE_WEIGHT');
    expect(response.body.targetWeightKg).toBe(85);
    expect(response.body.targetTimelineDays).toBe(60);
  });

  it('rejects nutrition preferences when preferred foods conflict with allergies or exclusions', async () => {
    const user = await registerTestUser(ctx.app);

    const response = await request(ctx.app.getHttpServer())
      .put('/v1/nutrition-preferences')
      .set(authHeader(user.accessToken))
      .send({
        dietType: 'NONE',
        mealsPerDay: 3,
        allergies: ['peanuts'],
        excludedFoods: ['shellfish'],
        preferredFoods: ['Peanuts']
      })
      .expect(400);

    expect(response.body.message).toContain('Preferred foods cannot include allergies');
  });

  it('rejects unsafe training duration and high intensity through symptoms', async () => {
    const user = await registerTestUser(ctx.app);

    await request(ctx.app.getHttpServer())
      .post('/v1/training-schedule/items')
      .set(authHeader(user.accessToken))
      .send({
        dayOfWeek: 1,
        localTime: '07:30',
        sportType: 'HIIT',
        durationMinutes: 150,
        intensity: 'HIGH',
        description: 'Hard session'
      })
      .expect(400);

    const response = await request(ctx.app.getHttpServer())
      .post('/v1/training-schedule/items')
      .set(authHeader(user.accessToken))
      .send({
        dayOfWeek: 2,
        localTime: '07:30',
        sportType: 'RUNNING',
        durationMinutes: 30,
        intensity: 'HIGH',
        description: 'Push hard even with dizziness'
      })
      .expect(400);

    expect(response.body.message).toContain('pain, illness, dizziness, or exhaustion');
  });

  it('detects restricted foods in notes by local phrase instead of whole sentence', () => {
    const safetyService = new SafetyService();
    const buildPlanWithNote = (note: string) => {
      const plan = createMockDailyPlan({
        planLocalDate: getUtcLocalDate(),
        planTimezone: 'UTC',
        firstName: 'FoodSafety',
        isMinor: false
      });

      plan.nutrition.meals[0].foods[0].name = 'Chicken bowl';
      plan.nutrition.meals[0].foods[0].notes = note;
      plan.reminders = [];

      return plan;
    };

    for (const note of [
      'Add variety and fiber, avoiding avocado.',
      'Choose vegetables, avoiding avocado.',
      'Avoid avocado.',
      'Without avocado.',
      'No avocado.',
      'Avocado-free option.',
      'This meal avoids your allergy: avocado.'
    ]) {
      expect(
        safetyService.validatePlanFoodSafety(buildPlanWithNote(note), {
          allergies: ['avocado'],
          excludedFoods: []
        }).passed
      ).toBe(true);
    }

    for (const note of [
      'Add avocado.',
      'Add sliced avocado.',
      'Serve with avocado.',
      'Top with avocado.',
      'Include avocado.',
      'Use avocado as a side.',
      'Pair with avocado.',
      'Mix in avocado.',
      'Avocado toast.',
      'Salad with avocado.'
    ]) {
      expect(
        safetyService.validatePlanFoodSafety(buildPlanWithNote(note), {
          allergies: ['avocado'],
          excludedFoods: []
        }).passed
      ).toBe(false);
    }

    const foodNamePlan = buildPlanWithNote('Simple and balanced.');
    foodNamePlan.nutrition.meals[0].foods[0].name = 'Avocado toast';

    expect(
      safetyService.validatePlanFoodSafety(foodNamePlan, {
        allergies: ['avocado'],
        excludedFoods: []
      }).passed
    ).toBe(false);
  });

  it('normalizes safe avoidance qualifiers out of food names before safety checks', () => {
    const buildPlanWithFoodName = (name: string) => {
      const plan = createMockDailyPlan({
        planLocalDate: getUtcLocalDate(),
        planTimezone: 'UTC',
        firstName: 'FoodNameSafety',
        isMinor: false
      });

      plan.nutrition.meals[0].foods[0].name = name;
      plan.nutrition.meals[0].foods[0].notes = 'Simple and balanced.';

      return plan;
    };

    for (const [inputName, expectedName] of [
      ['Mixed salad (no avocado, no broccoli)', 'Mixed salad'],
      ['Salad without avocado', 'Salad'],
      ['No-avocado salad', 'Salad'],
      ['Avocado-free salad', 'Salad']
    ] as const) {
      const result = normalizeDailyPlanFoodNames(buildPlanWithFoodName(inputName), {
        allergies: ['avocado'],
        excludedFoods: ['broccoli']
      });

      expect(result.normalizedPaths).toContain('nutrition.meals[0].foods[0].name');
      expect(result.planJson.nutrition.meals[0].foods[0].name).toBe(expectedName);
      expect(result.planJson.nutrition.meals[0].foods[0].notes).toContain('Prepared without');
      expect(
        new SafetyService().validatePlanFoodSafety(result.planJson, {
          allergies: ['avocado'],
          excludedFoods: ['broccoli']
        }).passed
      ).toBe(true);
    }

    for (const inputName of ['Avocado toast', 'Chicken with avocado', 'Salad with avocado']) {
      const result = normalizeDailyPlanFoodNames(buildPlanWithFoodName(inputName), {
        allergies: ['avocado'],
        excludedFoods: []
      });

      expect(result.normalizedPaths).toHaveLength(0);
      expect(
        new SafetyService().validatePlanFoodSafety(result.planJson, {
          allergies: ['avocado'],
          excludedFoods: []
        }).passed
      ).toBe(false);
    }
  });

  it('normalizes and checks restricted foods inside menu options', () => {
    const plan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'MenuSafety',
      isMinor: false,
      planQualityMode: PlanQualityMode.ADAPTIVE
    });

    plan.nutrition.menuOptions = [
      {
        label: 'Safe option',
        focus: 'Avoidance wording',
        meals: [
          {
            name: 'Lunch',
            purpose: 'Steady energy',
            foods: [
              {
                name: 'Mixed salad (no avocado)',
                portion: '1 bowl',
                notes: 'Prepared simply.'
              }
            ]
          }
        ]
      }
    ];

    const normalized = normalizeDailyPlanFoodNames(plan, {
      allergies: ['avocado'],
      excludedFoods: []
    });

    expect(normalized.normalizedPaths).toContain(
      'nutrition.menuOptions[0].meals[0].foods[0].name'
    );
    expect(normalized.planJson.nutrition.menuOptions?.[0].meals[0].foods[0].name).toBe(
      'Mixed salad'
    );
    expect(
      new SafetyService().validatePlanFoodSafety(normalized.planJson, {
        allergies: ['avocado'],
        excludedFoods: []
      }).passed
    ).toBe(true);

    const unsafePlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'MenuConflict',
      isMinor: false,
      planQualityMode: PlanQualityMode.ADAPTIVE
    });
    unsafePlan.nutrition.menuOptions = [
      {
        label: 'Unsafe option',
        focus: 'Conflict',
        meals: [
          {
            name: 'Lunch',
            purpose: 'Steady energy',
            foods: [
              {
                name: 'Avocado toast',
                portion: '1 serving',
                notes: 'Simple option.'
              }
            ]
          }
        ]
      }
    ];

    const result = new SafetyService().validatePlanFoodSafety(unsafePlan, {
      allergies: ['avocado'],
      excludedFoods: []
    });

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.conflicts[0].matchedPath).toBe(
        'nutrition.menuOptions[0].meals[0].foods[0].name'
      );
    }
  });

  it('applies pregnancy-sensitive plan safety checks without changing non-sensitive profiles', () => {
    const safetyService = new SafetyService();
    const plan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'PregnancySafety',
      isMinor: false
    });

    plan.nutrition.calorieGuidance.notes = 'Use an aggressive calorie deficit today.';
    plan.training.recommendation = 'Do a hard high-intensity session while pregnant.';

    expect(
      safetyService.validatePregnancySensitivePlanSafety(plan, PregnancyStatus.UNKNOWN).passed
    ).toBe(true);
    expect(
      safetyService.validatePregnancySensitivePlanSafety(plan, PregnancyStatus.PREGNANT).passed
    ).toBe(false);
    expect(
      safetyService.validatePregnancySensitivePlanSafety(plan, PregnancyStatus.POSTPARTUM).passed
    ).toBe(false);
    expect(
      safetyService.validatePregnancySensitivePlanSafety(plan, PregnancyStatus.BREASTFEEDING)
        .passed
    ).toBe(false);
  });

  it('rejects unsafe exercise advice in deterministic SafetyService checks', () => {
    const safetyService = new SafetyService();
    const basePlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'ExerciseSafety',
      isMinor: false,
      planQualityMode: PlanQualityMode.PERSONALIZED
    });

    const baseInput = {
      safeMode: false,
      isMinor: false,
      pregnancyStatus: PregnancyStatus.UNKNOWN,
      trainingLevel: TrainingLevel.INTERMEDIATE,
      limitationsOrPainAreas: [],
      painOrDiscomfortReported: false,
      highTirednessReported: false
    };

    expect(
      safetyService.validatePlanExerciseSafety({
        ...baseInput,
        planJson: {
          ...basePlan,
          training: {
            ...basePlan.training,
            exercises: [
              {
                name: 'Run intervals',
                targetMuscles: ['legs'],
                equipment: ['bodyweight'],
                safetyNotes: 'Push through pain to finish the set.'
              }
            ]
          }
        }
      }).passed
    ).toBe(false);

    expect(
      safetyService.validatePlanExerciseSafety({
        ...baseInput,
        trainingLevel: TrainingLevel.BEGINNER,
        planJson: {
          ...basePlan,
          training: {
            ...basePlan.training,
            exercises: [
              {
                name: 'Heavy deadlift',
                targetMuscles: ['back', 'legs'],
                equipment: ['barbell'],
                intensityCue: 'Use max effort and train to failure.'
              }
            ]
          }
        }
      }).passed
    ).toBe(false);

    expect(
      safetyService.validatePlanExerciseSafety({
        ...baseInput,
        pregnancyStatus: PregnancyStatus.POSTPARTUM,
        planJson: {
          ...basePlan,
          training: {
            ...basePlan.training,
            exercises: [
              {
                name: 'Jump squats',
                targetMuscles: ['legs'],
                equipment: ['bodyweight'],
                intensityCue: 'All-out effort for postpartum fitness.'
              }
            ]
          }
        }
      }).passed
    ).toBe(false);

    expect(
      safetyService.validatePlanExerciseSafety({
        ...baseInput,
        limitationsOrPainAreas: ['knee pain'],
        planJson: {
          ...basePlan,
          training: {
            ...basePlan.training,
            exercises: [
              {
                name: 'Step-up',
                targetMuscles: ['legs'],
                equipment: ['bench'],
                safetyNotes: 'Ignore knee pain and keep going.'
              }
            ]
          }
        }
      }).passed
    ).toBe(false);
  });

  it('falls back when generated training advice is unsafe for pregnancy-sensitive context', async () => {
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async () => {
              const plan = createMockDailyPlan({
                planLocalDate: getUtcLocalDate(),
                planTimezone: 'UTC',
                firstName: 'PregnancyPlan',
                isMinor: false
              });

              plan.training.recommendation =
                'Because you are pregnant, complete an all-out high-intensity session today.';

              return plan;
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'pregnancy-plan-safety@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'PregnancyPlan');
      const profile = await request(customCtx.app.getHttpServer())
        .put('/v1/profile')
        .set(authHeader(user.accessToken))
        .send({
          firstName: 'PregnancyPlan',
          gender: 'female',
          pregnancyStatus: PregnancyStatus.PREGNANT,
          dateOfBirth: '1990-01-01',
          heightCm: 170,
          weightKg: 70,
          activityLevel: 'MODERATE',
          privacyConsentAccepted: true
        })
        .expect(200);

      expect(profile.body.profile.pregnancyStatus).toBe(PregnancyStatus.PREGNANT);
      await expect(
        customCtx.prisma.profile.findUniqueOrThrow({
          where: { userId: user.user.id },
          select: { pregnancyStatus: true }
        })
      ).resolves.toEqual({ pregnancyStatus: PregnancyStatus.PREGNANT });

      const response = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(response.body.status).toBe('FALLBACK');
      expect(response.body.plan.safety.reasons[0]).toContain('pregnancy');
      expect(response.body.plan.safety.userSafeMessage).toContain('extra care');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('persists fallback when generated exercise advice is unsafe', async () => {
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async () => {
              const plan = createMockDailyPlan({
                planLocalDate: getUtcLocalDate(),
                planTimezone: 'UTC',
                firstName: 'UnsafeExercise',
                isMinor: false,
                planQualityMode: PlanQualityMode.PERSONALIZED
              });

              plan.training.exercises = [
                {
                  name: 'Heavy deadlift',
                  targetMuscles: ['back', 'legs'],
                  equipment: ['barbell'],
                  intensityCue: 'Use max effort and train to failure.'
                }
              ];

              return plan;
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'unsafe-exercise-plan@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'UnsafeExercise');

      await request(customCtx.app.getHttpServer())
        .put('/v1/training-preferences')
        .set(authHeader(user.accessToken))
        .send({ trainingLevel: TrainingLevel.BEGINNER })
        .expect(200);

      const response = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(response.body.status).toBe('FALLBACK');
      expect(response.body.plan.safety.reasons).toContain(
        'The generated plan included exercise guidance that needs to be made safer.'
      );
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('persists a safe fallback plan if generated foods conflict with allergies', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'Fallback');

    await request(ctx.app.getHttpServer())
      .put('/v1/nutrition-preferences')
      .set(authHeader(user.accessToken))
      .send({
        dietType: 'NONE',
        mealsPerDay: 3,
        allergies: ['Greek yogurt'],
        excludedFoods: [],
        preferredFoods: ['rice']
      })
      .expect(200);

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    expect(plan.body.status).toBe('FALLBACK');
    expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
    expect(JSON.stringify(plan.body.plan)).not.toContain('Greek yogurt');
    expect(JSON.stringify(plan.body.plan)).toContain('conflicts with your allergies');
    expect(plan.body.plan.safety.userSafeMessage).toContain('allergies or excluded foods');
  });

  it('normalizes old Sprint 1 plan JSON without crashing the response', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'Legacy');
    const legacyLocalDate = getUtcLocalDate();

    await ctx.prisma.dailyPlan.create({
      data: {
        userId: user.user.id,
        planLocalDate: legacyLocalDate,
        planTimezone: 'UTC',
        status: 'READY',
        readinessLevel: 'MAINTAIN',
        createdByAi: false,
        planJson: {
          status: 'READY',
          readinessLevel: 'MAINTAIN',
          planLocalDate: legacyLocalDate,
          planTimezone: 'UTC',
          generatedAt: '2026-06-02T00:00:00.000Z',
          mockVersion: 'legacy',
          plan: {
            summary: 'Legacy plan summary',
            calorieGuidance: {
              targetCalories: 2100,
              reason: 'A balanced target for steady energy today.'
            },
            macroGuidance: {
              proteinGrams: 130,
              carbsGrams: 220,
              fatsGrams: 65
            },
            meals: [
              {
                mealName: 'Breakfast',
                timing: 'Morning',
                foods: [{ name: 'Eggs', portion: '2', notes: 'Simple option' }],
                approxCalories: 400,
                notes: 'Steady start'
              }
            ],
            hydration: {
              targetLiters: 2.3,
              timingNotes: 'Sip regularly.'
            },
            trainingRecommendation: {
              mode: 'MAINTAIN',
              summary: 'Controlled movement.',
              intensity: 'MODERATE',
              durationMinutes: 45
            },
            recoveryRecommendation: {
              summary: 'Rest well.',
              actions: ['Hydrate regularly']
            },
            coachExplanation: 'Consistency matters.',
            warnings: []
          }
        }
      }
    });

    const today = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/today')
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(today.body.id).toBeTruthy();
    expect(today.body.plan.schemaVersion).toBe('sprint-2.v1');
    expect(today.body.plan.summary.message).toBe('Legacy plan summary');
    expect(dailyPlanJsonSchema.safeParse(today.body.plan).success).toBe(true);
  });

  it('returns only the authenticated user daily plan history with normalized plans', async () => {
    const firstUser = await registerTestUser(ctx.app, 'history-one@example.com');
    const secondUser = await registerTestUser(ctx.app, 'history-two@example.com');

    await completeRequiredOnboarding(ctx.app, firstUser.accessToken, 'HistoryOne');
    await completeRequiredOnboarding(ctx.app, secondUser.accessToken, 'HistoryTwo');

    const firstPlan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(firstUser.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const secondPlan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(secondUser.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const history = await request(ctx.app.getHttpServer())
      .get('/v1/daily-plans/history?limit=10')
      .set(authHeader(firstUser.accessToken))
      .expect(200);

    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].id).toBe(firstPlan.body.id);
    expect(history.body.items[0].id).not.toBe(secondPlan.body.id);
    expect(dailyPlanJsonSchema.safeParse(history.body.items[0].plan).success).toBe(true);
  });

  it('creates and reads meal, training, and evening daily plan check-ins', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'CheckIn');

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const meal = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/check-ins`)
      .set(authHeader(user.accessToken))
      .send({
        type: DailyCheckInType.MEAL,
        payload: {
          mealIndex: 0,
          mealName: 'Breakfast',
          status: 'COMPLETED',
          notes: 'Easy and steady.'
        }
      })
      .expect(201);

    expect(meal.body.type).toBe(DailyCheckInType.MEAL);
    expect(meal.body.subjectKey).toBe('meal:0');

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/check-ins`)
      .set(authHeader(user.accessToken))
      .send({
        type: DailyCheckInType.TRAINING,
        payload: {
          status: 'RESTED_INSTEAD',
          perceivedDifficulty: 3,
          energyAfter: 6,
          painOrDiscomfort: true,
          notes: 'Felt knee pain, so I kept it gentle.'
        }
      })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/check-ins`)
      .set(authHeader(user.accessToken))
      .send({
        type: DailyCheckInType.EVENING_REFLECTION,
        payload: {
          energyLevel: 6,
          tirednessLevel: 8,
          sorenessLevel: 5,
          mood: 'calm',
          notes: 'A bit tired tonight.'
        }
      })
      .expect(201);

    const checkIns = await request(ctx.app.getHttpServer())
      .get(`/v1/daily-plans/${plan.body.id}/check-ins`)
      .set(authHeader(user.accessToken))
      .expect(200);

    expect(checkIns.body.items).toHaveLength(3);
    expect(checkIns.body.items.map((item: { type: string }) => item.type)).toEqual(
      expect.arrayContaining([
        DailyCheckInType.MEAL,
        DailyCheckInType.TRAINING,
        DailyCheckInType.EVENING_REFLECTION
      ])
    );
  });

  it('updates an existing check-in when submitted again for the same subject', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'CheckInUpdate');

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const first = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/check-ins`)
      .set(authHeader(user.accessToken))
      .send({
        type: DailyCheckInType.MEAL,
        payload: {
          mealIndex: 1,
          mealName: 'Lunch',
          status: 'SKIPPED'
        }
      })
      .expect(201);

    const updated = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/check-ins`)
      .set(authHeader(user.accessToken))
      .send({
        type: DailyCheckInType.MEAL,
        payload: {
          mealIndex: 1,
          mealName: 'Lunch',
          status: 'SWAPPED',
          notes: 'Changed plans, no stress.'
        }
      })
      .expect(201);

    expect(updated.body.id).toBe(first.body.id);
    expect(updated.body.payload.status).toBe('SWAPPED');

    await expect(
      ctx.prisma.dailyPlanCheckIn.count({
        where: {
          userId: user.user.id,
          dailyPlanId: plan.body.id,
          type: DailyCheckInType.MEAL,
          subjectKey: 'meal:1'
        }
      })
    ).resolves.toBe(1);
  });

  it('rejects invalid check-in payloads and long notes', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'CheckInInvalid');

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/check-ins`)
      .set(authHeader(user.accessToken))
      .send({
        type: DailyCheckInType.TRAINING,
        payload: {
          status: 'CRUSHED_IT',
          perceivedDifficulty: 11
        }
      })
      .expect(400);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/check-ins`)
      .set(authHeader(user.accessToken))
      .send({
        type: DailyCheckInType.MEAL,
        payload: {
          mealIndex: 0,
          status: 'COMPLETED',
          notes: 'x'.repeat(501)
        }
      })
      .expect(400);
  });

  it('prevents users from reading or creating check-ins for another user plan', async () => {
    const owner = await registerTestUser(ctx.app, 'checkin-owner@example.com');
    const otherUser = await registerTestUser(ctx.app, 'checkin-other@example.com');

    await completeRequiredOnboarding(ctx.app, owner.accessToken, 'CheckInOwner');
    await completeRequiredOnboarding(ctx.app, otherUser.accessToken, 'CheckInOther');

    const ownerPlan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(owner.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .get(`/v1/daily-plans/${ownerPlan.body.id}/check-ins`)
      .set(authHeader(otherUser.accessToken))
      .expect(404);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${ownerPlan.body.id}/check-ins`)
      .set(authHeader(otherUser.accessToken))
      .send({
        type: DailyCheckInType.MEAL,
        payload: {
          mealIndex: 0,
          status: 'COMPLETED'
        }
      })
      .expect(404);
  });

  it('adds recent check-in summary to personalized planning context', async () => {
    const provider: { generateDailyPlan: jest.Mock<Promise<ReturnType<typeof createMockDailyPlan>>, [GenerateDailyPlanInput]> } = {
      generateDailyPlan: jest.fn(async (_input: GenerateDailyPlanInput) =>
        createMockDailyPlan({
          planLocalDate: getUtcLocalDate(),
          planTimezone: 'UTC',
          firstName: 'CheckInContext',
          isMinor: false,
          planQualityMode: PlanQualityMode.PERSONALIZED
        })
      )
    };
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: provider
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'checkin-context@example.com');
      await createTestSubscription(customCtx, user.user.id, {
        plan: SubscriptionPlan.PLUS,
        status: SubscriptionStatus.ACTIVE
      });
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'CheckInContext');

      const firstPlan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      await request(customCtx.app.getHttpServer())
        .post(`/v1/daily-plans/${firstPlan.body.id}/check-ins`)
        .set(authHeader(user.accessToken))
        .send({
          type: DailyCheckInType.TRAINING,
          payload: {
            status: 'RESTED_INSTEAD',
            painOrDiscomfort: true,
            notes: 'Pain today, kept it light.'
          }
        })
        .expect(201);

      await request(customCtx.app.getHttpServer())
        .post(`/v1/daily-plans/${firstPlan.body.id}/check-ins`)
        .set(authHeader(user.accessToken))
        .send({
          type: DailyCheckInType.EVENING_REFLECTION,
          payload: {
            tirednessLevel: 9
          }
        })
        .expect(201);

      await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      const secondCallInput = provider.generateDailyPlan.mock.calls[1]?.[0] as
        | GenerateDailyPlanInput
        | undefined;

      if (!secondCallInput) {
        throw new Error('Expected a second daily plan provider call.');
      }

      expect(secondCallInput.personalizationContext.checkInSummary).toMatchObject({
        painOrDiscomfortReported: true,
        highTirednessReported: true,
        conservativeTrainingRecommended: true
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('persists and updates one feedback record per user daily plan', async () => {
    const user = await registerTestUser(ctx.app);
    await completeRequiredOnboarding(ctx.app, user.accessToken, 'Feedback');

    const plan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(user.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    const firstFeedback = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/feedback`)
      .set(authHeader(user.accessToken))
      .send({
        rating: 'HELPFUL',
        tags: ['FELT_GOOD']
      })
      .expect(201);

    expect(firstFeedback.body.rating).toBe('HELPFUL');
    expect(firstFeedback.body.tags).toEqual(['FELT_GOOD']);

    const updatedFeedback = await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${plan.body.id}/feedback`)
      .set(authHeader(user.accessToken))
      .send({
        rating: 'NOT_HELPFUL',
        tags: ['LOW_ENERGY', 'TRAINING_TOO_HARD'],
        notes: 'Needed an easier day.'
      })
      .expect(201);

    expect(updatedFeedback.body.id).toBe(firstFeedback.body.id);
    expect(updatedFeedback.body.rating).toBe('NOT_HELPFUL');
    expect(updatedFeedback.body.tags).toEqual(['LOW_ENERGY', 'TRAINING_TOO_HARD']);
    expect(updatedFeedback.body.notes).toBe('Needed an easier day.');

    const feedbackCount = await ctx.prisma.dailyPlanFeedback.count({
      where: {
        userId: user.user.id,
        dailyPlanId: plan.body.id
      }
    });

    expect(feedbackCount).toBe(1);
  });

  it('prevents users from submitting feedback for another user plan', async () => {
    const owner = await registerTestUser(ctx.app, 'owner@example.com');
    const otherUser = await registerTestUser(ctx.app, 'other@example.com');

    await completeRequiredOnboarding(ctx.app, owner.accessToken, 'Owner');
    await completeRequiredOnboarding(ctx.app, otherUser.accessToken, 'Other');

    const ownerPlan = await request(ctx.app.getHttpServer())
      .post('/v1/daily-plans/generate')
      .set(authHeader(owner.accessToken))
      .send({ forceRegenerate: true })
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post(`/v1/daily-plans/${ownerPlan.body.id}/feedback`)
      .set(authHeader(otherUser.accessToken))
      .send({
        rating: 'HELPFUL',
        tags: ['FELT_GOOD']
      })
      .expect(404);
  });

  it('generates daily plans through the AiProvider abstraction', async () => {
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async (input: {
              planLocalDate: string;
              planTimezone: string;
              user: { firstName: string | null };
              safeMode: boolean;
            }) => ({
              ...createMockDailyPlan({
                planLocalDate: input.planLocalDate,
                planTimezone: input.planTimezone,
                firstName: input.user.firstName,
                isMinor: input.safeMode,
                planQualityMode: PlanQualityMode.BASIC
              }),
              summary: {
                title: 'Provider seam verified',
                message: 'This plan came from the injected provider.',
                readiness: 'MAINTAIN'
              }
            })
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'provider-seam@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'Provider');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.summary.title).toBe('Provider seam verified');
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('passes PlanQualityMode and tier-aware personalization context to AiProvider', async () => {
    const providerInputs: Array<{
      planQualityMode: PlanQualityMode;
      personalizationContext: { contextLevel: string; trainingPersonalization: { exerciseDetailLevel: string } };
    }> = [];
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async (input: {
              planLocalDate: string;
              planTimezone: string;
              user: { firstName: string | null };
              safeMode: boolean;
              planQualityMode: PlanQualityMode;
              personalizationContext: {
                contextLevel: string;
                trainingPersonalization: { exerciseDetailLevel: string };
              };
            }) => {
              providerInputs.push({
                planQualityMode: input.planQualityMode,
                personalizationContext: input.personalizationContext
              });

              return createMockDailyPlan({
                planLocalDate: input.planLocalDate,
                planTimezone: input.planTimezone,
                firstName: input.user.firstName,
                isMinor: input.safeMode,
                planQualityMode: input.planQualityMode
              });
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const freeUser = await registerTestUser(customCtx.app, 'provider-basic@example.com');
      const plusUser = await registerTestUser(customCtx.app, 'provider-personalized@example.com');
      const proUser = await registerTestUser(customCtx.app, 'provider-adaptive@example.com');
      await completeRequiredOnboarding(customCtx.app, freeUser.accessToken, 'ProviderBasic');
      await completeRequiredOnboarding(customCtx.app, plusUser.accessToken, 'ProviderPersonalized');
      await completeRequiredOnboarding(customCtx.app, proUser.accessToken, 'ProviderAdaptive');
      await createTestSubscription(customCtx, plusUser.user.id, {
        plan: SubscriptionPlan.PLUS,
        status: SubscriptionStatus.ACTIVE
      });
      await createTestSubscription(customCtx, proUser.user.id, {
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE
      });

      for (const user of [freeUser, plusUser, proUser]) {
        await request(customCtx.app.getHttpServer())
          .post('/v1/daily-plans/generate')
          .set(authHeader(user.accessToken))
          .send({ forceRegenerate: true })
          .expect(201);
      }

      expect(providerInputs).toMatchObject([
        {
          planQualityMode: PlanQualityMode.BASIC,
          personalizationContext: {
            contextLevel: 'minimal',
            trainingPersonalization: { exerciseDetailLevel: 'simple' }
          }
        },
        {
          planQualityMode: PlanQualityMode.PERSONALIZED,
          personalizationContext: {
            contextLevel: 'personalized',
            trainingPersonalization: { exerciseDetailLevel: 'sets_reps_rest' }
          }
        },
        {
          planQualityMode: PlanQualityMode.ADAPTIVE,
          personalizationContext: {
            contextLevel: 'adaptive',
            trainingPersonalization: { exerciseDetailLevel: 'adaptive' }
          }
        }
      ]);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('uses a safe fallback if AiProvider output is invalid', async () => {
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: AI_PROVIDER,
          value: {
            generateDailyPlan: async () => ({
              schemaVersion: 'invalid-provider-output'
            })
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'invalid-provider@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'Invalid');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
      expect(plan.body.plan.safety.adjustedForSafety).toBe(true);
      expect(plan.body.plan.safety.userSafeMessage).toBe(
        'We used a reliable safe plan today because the generated plan could not be fully verified.'
      );
      expect(JSON.stringify(plan.body.plan)).toContain('could not be safely validated');
      expect(plan.body.plan.debug).toMatchObject({
        provider: 'fallback',
        generatedBy: 'SafeFallbackPlanFactory',
        fallbackReason: 'The generated plan could not be safely validated.',
        planQualityMode: 'BASIC'
      });
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
    }
  });

  it('uses mock provider by default without requiring OPENAI_API_KEY', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;

    const customCtx = await createTestApp();

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'mock-default@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'MockDefault');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
      expect(plan.body.plan.debug).toMatchObject({
        provider: 'mock',
        generatedBy: 'MockAiProviderService',
        planQualityMode: 'BASIC'
      });
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(previousProvider, previousApiKey);
    }
  });

  it('validates SafetyAgentReview schema rules', () => {
    expect(
      safetyAgentReviewSchema.safeParse({
        approved: true,
        riskLevel: 'low',
        reasons: [],
        requiredChanges: []
      }).success
    ).toBe(true);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: true,
        riskLevel: 'medium',
        reasons: [],
        requiredChanges: []
      }).success
    ).toBe(false);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: true,
        riskLevel: 'high',
        reasons: [],
        requiredChanges: []
      }).success
    ).toBe(false);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: false,
        riskLevel: 'medium',
        reasons: [],
        requiredChanges: ['Use more supportive wording.']
      }).success
    ).toBe(false);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: false,
        riskLevel: 'medium',
        reasons: ['Tone is not supportive enough.'],
        requiredChanges: ['Use calmer, supportive wording.'],
        safeUserMessage: 'Choose a gentler plan today.'
      }).success
    ).toBe(true);

    expect(
      safetyAgentReviewSchema.safeParse({
        approved: false,
        riskLevel: 'medium',
        reasons: ['Tone is not supportive enough.'],
        requiredChanges: ['Use calmer, supportive wording.'],
        safeUserMessage: 'You are lazy and need punishment.'
      }).success
    ).toBe(false);
  });

  it('registers mock SafetyAgent defaults without changing runtime behavior', async () => {
    const safetyAgentConfig = ctx.app.get<SafetyAgentConfig>(SAFETY_AGENT_CONFIG);
    const safetyAgent = ctx.app.get<SafetyAgent>(SAFETY_AGENT);
    const plan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'SafetyAgent',
      isMinor: false
    });

    await expect(
      safetyAgent.reviewDailyPlan({
        plan,
        safeMode: false,
        goalSummary: {
          goalType: 'IMPROVE_FITNESS',
          targetWeightKg: null,
          targetTimelineDays: null,
          impactMode: null
        },
        deterministicSafetyContext: {
          safeMode: false,
          isMinor: false,
          allergies: [],
          excludedFoods: [],
          deterministicSafetyPassed: true
        }
      })
    ).resolves.toEqual({
      approved: true,
      riskLevel: 'low',
      reasons: [],
      requiredChanges: []
    });

    expect(safetyAgentConfig).toEqual({
      enabled: false,
      provider: 'mock'
    });
  });

  it('does not call SafetyAgent when SAFETY_AGENT_ENABLED=false', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    process.env.SAFETY_AGENT_ENABLED = 'false';
    let reviewCalls = 0;
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: SAFETY_AGENT,
          value: {
            reviewDailyPlan: async () => {
              reviewCalls += 1;
              throw new Error('SafetyAgent should not be called when disabled.');
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-disabled@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyDisabled');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.safetyAgent).toBeUndefined();
      expect(reviewCalls).toBe(0);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, process.env.SAFETY_AGENT_PROVIDER);
    }
  });

  it('calls enabled mock SafetyAgent after deterministic safety passes', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    process.env.SAFETY_AGENT_ENABLED = 'true';
    let reviewCalls = 0;
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: SAFETY_AGENT,
          value: {
            reviewDailyPlan: async () => {
              reviewCalls += 1;
              return {
                approved: true,
                riskLevel: 'low',
                reasons: [],
                requiredChanges: []
              };
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-enabled@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyEnabled');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'mock',
        approved: true,
        riskLevel: 'low'
      });
      expect(reviewCalls).toBe(1);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, process.env.SAFETY_AGENT_PROVIDER);
    }
  });

  it('skips SafetyAgent when deterministic safety fails', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    process.env.SAFETY_AGENT_ENABLED = 'true';
    let reviewCalls = 0;
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: SAFETY_AGENT,
          value: {
            reviewDailyPlan: async () => {
              reviewCalls += 1;
              return {
                approved: true,
                riskLevel: 'low',
                reasons: [],
                requiredChanges: []
              };
            }
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-hard-fail@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyHardFail');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['Greek yogurt'],
          excludedFoods: [],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.safetyAgent).toBeUndefined();
      expect(reviewCalls).toBe(0);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, process.env.SAFETY_AGENT_PROVIDER);
    }
  });

  it.each([
    [
      'saves fallback when SafetyAgent rejects',
      async () => ({
        approved: false,
        riskLevel: 'medium',
        reasons: ['Plan tone needs semantic review.'],
        requiredChanges: ['Use safer wording.']
      }),
      'safety_agent_rejected',
      { approved: false, riskLevel: 'medium' }
    ],
    [
      'saves fallback when SafetyAgent throws',
      async () => {
        throw new Error('SafetyAgent unavailable');
      },
      'safety_agent_unavailable',
      {}
    ],
    [
      'saves fallback when SafetyAgent returns invalid review',
      async () => ({
        approved: true,
        riskLevel: 'high',
        reasons: [],
        requiredChanges: []
      }),
      'safety_agent_invalid_review',
      {}
    ]
  ])('%s', async (_name, reviewDailyPlan, expectedReason, expectedDebug) => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    process.env.SAFETY_AGENT_ENABLED = 'true';
    const customCtx = await createTestApp({
      providerOverrides: [
        {
          token: SAFETY_AGENT,
          value: {
            reviewDailyPlan
          }
        }
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, `${expectedReason}@example.com`);
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyFallback');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe(expectedReason);
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'mock',
        ...expectedDebug
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, process.env.SAFETY_AGENT_PROVIDER);
    }
  });

  it('does not require OpenAI Safety Agent config when SAFETY_AGENT_ENABLED=false', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    const previousProvider = process.env.SAFETY_AGENT_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    const previousModel = process.env.OPENAI_DEFAULT_MODEL;
    process.env.SAFETY_AGENT_ENABLED = 'false';
    process.env.SAFETY_AGENT_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_DEFAULT_MODEL;

    const customCtx = await createTestApp();

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-openai-disabled@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyOpenAiDisabled');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.safetyAgent).toBeUndefined();
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(previousEnabled, previousProvider);
      restoreOpenAiEnv(process.env.AI_PROVIDER, previousApiKey, previousModel);
    }
  });

  it('fails clearly when OpenAI Safety Agent is enabled without OPENAI_API_KEY', async () => {
    const previousEnabled = process.env.SAFETY_AGENT_ENABLED;
    const previousProvider = process.env.SAFETY_AGENT_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    process.env.SAFETY_AGENT_ENABLED = 'true';
    process.env.SAFETY_AGENT_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(createTestApp()).rejects.toThrow(
        'OPENAI_API_KEY is required when SAFETY_AGENT_PROVIDER=openai.'
      );
    } finally {
      restoreSafetyAgentEnv(previousEnabled, previousProvider);
      process.env.OPENAI_API_KEY =
        previousApiKey === undefined ? process.env.OPENAI_API_KEY : previousApiKey;
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      }
    }
  });

  it('uses OpenAiSafetyAgentService when enabled with SAFETY_AGENT_PROVIDER=openai', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiSafetyAgentModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify({
            approved: true,
            riskLevel: 'low',
            reasons: [],
            requiredChanges: [],
            safeUserMessage: ''
          })
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-openai-approve@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyOpenAiApprove');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        approved: true,
        riskLevel: 'low'
      });
      expect(requests[0].text).toMatchObject({
        format: {
          type: 'json_schema',
          name: 'safety_agent_review',
          strict: true
        }
      });
      const safetyAgentInput = requests[0].input as Array<{ content?: string }>;
      expect(safetyAgentInput[0].content).toContain('Reject gender-stereotyped');
      expect(safetyAgentInput[0].content).toContain('If pregnancyStatus is PREGNANT');
      expect(safetyAgentInput[0].content).toContain('Review training.exercises');
      expect(safetyAgentInput[0].content).toContain('unsafe exercise recommendations');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it.each([
    [
      'returns fallback when OpenAI Safety Agent rejects',
      () => ({
        output_text: JSON.stringify({
          approved: false,
          riskLevel: 'medium',
          reasons: ['The plan uses unsafe training framing.'],
          requiredChanges: ['Remove unsafe training framing.'],
          safeUserMessage: 'Choose a safer plan today.'
        })
      }),
      'safety_agent_rejected'
    ],
    [
      'returns fallback when OpenAI Safety Agent returns invalid review',
      () => ({
        output_text: JSON.stringify({
          approved: true,
          riskLevel: 'high',
          reasons: [],
          requiredChanges: [],
          safeUserMessage: ''
        })
      }),
      'safety_agent_invalid_review'
    ],
    [
      'returns fallback when OpenAI Safety Agent request fails',
      () => ({
        throw: { name: 'APIConnectionTimeoutError', message: 'Request timeout', code: 'ETIMEDOUT' }
      }),
      'safety_agent_unavailable'
    ]
  ])('%s', async (_name, responseFactory, expectedReason) => {
    const customCtx = await createOpenAiSafetyAgentModeTestApp({
      responses: [responseFactory]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, `${expectedReason}-openai@example.com`);
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyOpenAiFallback');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe(expectedReason);
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('skips OpenAI Safety Agent when deterministic safety fails', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiSafetyAgentModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify({
            approved: true,
            riskLevel: 'low',
            reasons: [],
            requiredChanges: [],
            safeUserMessage: ''
          })
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-agent-openai-hard-fail@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'SafetyOpenAiHardFail');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['Greek yogurt'],
          excludedFoods: [],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.safetyAgent).toBeUndefined();
      expect(requests).toHaveLength(0);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('retries OpenAI daily plan once with SafetyAgent feedback and saves READY when retry passes', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const firstPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetrySafety',
      isMinor: false
    });
    const retriedPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetrySafetyFixed',
      isMinor: false
    });

    const customCtx = await createOpenAiDailyAndSafetyAgentModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify(firstPlan) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Training wording is too aggressive.'],
            requiredChanges: ['Use gentler training wording.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        }),
        () => ({ output_text: JSON.stringify(retriedPlan) }),
        () => ({
          output_text: JSON.stringify({
            approved: true,
            riskLevel: 'low',
            reasons: [],
            requiredChanges: [],
            safeUserMessage: ''
          })
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-retry-ready@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'RetrySafety');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.provider).toBe('openai');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        approved: true,
        riskLevel: 'low',
        retryUsed: true,
        retryResult: 'approved'
      });
      expect(requests).toHaveLength(4);
      const retryRequestInput = requests[2].input as Array<{ content?: string }>;
      const retryContext = JSON.parse(retryRequestInput[1].content ?? '{}') as {
        safetyFeedback?: unknown;
      };
      expect(retryContext.safetyFeedback).toMatchObject({
        riskLevel: 'medium',
        reasons: ['Training wording is too aggressive.'],
        requiredChanges: ['Use gentler training wording.']
      });

      const operationLog = await customCtx.prisma.aiOperationLog.findFirstOrThrow({
        where: { userId: user.user.id }
      });

      expect(operationLog).toMatchObject({
        feature: AiOperationFeature.DAILY_PLAN,
        provider: AiOperationProvider.OPENAI,
        model: 'test-openai-model',
        status: AiOperationStatus.SUCCESS,
        retryCount: 1,
        safetyAgentEnabled: true,
        safetyAgentProvider: 'openai',
        safetyAgentApproved: true,
        fallbackReason: null,
        errorReason: null
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('saves FALLBACK when SafetyAgent rejects the retried OpenAI plan', async () => {
    const planJson = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetryRejected',
      isMinor: false
    });
    const customCtx = await createOpenAiDailyAndSafetyAgentModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify(planJson) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Tone is too forceful.'],
            requiredChanges: ['Use softer tone.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        }),
        () => ({ output_text: JSON.stringify(planJson) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Tone is still too forceful.'],
            requiredChanges: ['Use softer tone.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-retry-rejected@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'RetryRejected');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe('safety_agent_retry_rejected');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        approved: false,
        riskLevel: 'medium',
        retryUsed: true,
        retryResult: 'rejected'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('saves FALLBACK when retry OpenAI generation fails', async () => {
    const planJson = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetryFailed',
      isMinor: false
    });
    const customCtx = await createOpenAiDailyAndSafetyAgentModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify(planJson) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Plan needs safer wording.'],
            requiredChanges: ['Use safer wording.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        }),
        () => ({ throw: { name: 'APIConnectionTimeoutError', message: 'Request timeout', code: 'ETIMEDOUT' } }),
        () => ({ throw: { name: 'APIConnectionTimeoutError', message: 'Request timeout', code: 'ETIMEDOUT' } })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-retry-failed@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'RetryFailed');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe('safety_agent_retry_failed');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        retryUsed: true,
        retryResult: 'failed'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('saves FALLBACK when retry OpenAI generation returns invalid structured output', async () => {
    const planJson = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'RetryInvalidOutput',
      isMinor: false
    });
    const invalidDailyPlan = {
      summary: {
        title: 'Incomplete retry plan'
      }
    };
    const customCtx = await createOpenAiDailyAndSafetyAgentModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify(planJson) }),
        () => ({
          output_text: JSON.stringify({
            approved: false,
            riskLevel: 'medium',
            reasons: ['Plan needs safer wording.'],
            requiredChanges: ['Use safer wording.'],
            safeUserMessage: 'Choose a safer plan today.'
          })
        }),
        () => ({ output_text: JSON.stringify(invalidDailyPlan) }),
        () => ({ output_text: JSON.stringify(invalidDailyPlan) })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'safety-retry-invalid@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'RetryInvalidOutput');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe('safety_agent_retry_invalid_output');
      expect(plan.body.plan.debug.safetyAgent).toMatchObject({
        enabled: true,
        provider: 'openai',
        retryUsed: true,
        retryResult: 'failed'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreSafetyAgentEnv(undefined, undefined);
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('fails fast when AI_PROVIDER=openai is configured without OPENAI_API_KEY', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    process.env.AI_PROVIDER = 'openai';
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(createTestApp()).rejects.toThrow(
        'OPENAI_API_KEY is required when AI_PROVIDER=openai.'
      );
    } finally {
      restoreOpenAiEnv(previousProvider, previousApiKey);
    }
  });

  it('fails fast when AI_PROVIDER=openai is configured without OPENAI_DEFAULT_MODEL', async () => {
    const previousProvider = process.env.AI_PROVIDER;
    const previousApiKey = process.env.OPENAI_API_KEY;
    const previousModel = process.env.OPENAI_DEFAULT_MODEL;
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.OPENAI_DEFAULT_MODEL;

    try {
      await expect(createTestApp()).rejects.toThrow(
        'OPENAI_DEFAULT_MODEL is required when AI_PROVIDER=openai.'
      );
    } finally {
      restoreOpenAiEnv(previousProvider, previousApiKey, previousModel);
    }
  });

  it('uses OpenAiProviderService and sends a structured-output request when AI_PROVIDER=openai', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'OpenAI',
              isMinor: false
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-provider@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'OpenAI');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
      expect(plan.body.plan.debug).toMatchObject({
        provider: 'openai',
        generatedBy: 'OpenAiProviderService',
        planQualityMode: 'BASIC'
      });
      expect(requests).toHaveLength(1);
      expect(requests[0].model).toBe('test-openai-model');
      expect(requests[0].max_output_tokens).toBe(4000);
      expect(requests[0].requestTimeout).toBe(45000);
      expect(requests[0]).toMatchObject({
        text: {
          format: {
            type: 'json_schema',
            name: 'daily_plan_json',
            strict: true
          }
        }
      });
      expect(JSON.stringify(requests[0].input)).toContain('usePlanLocalDateForTitleAndMessage');
      expect(JSON.stringify(requests[0].input)).toContain('Do not include schemaVersion');
      expect(JSON.stringify(requests[0].input)).toContain('Never derive user-facing dates from generatedAt');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('OpenAI generation consumes AI usage', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'OpenAiUsage',
              isMinor: false
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-usage@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'OpenAiUsage');

      await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: false })
        .expect(201);

      await expect(
        customCtx.app.get(UsageLedgerService).getUsage(
          user.user.id,
          UsageFeature.AI_DAILY_PLAN_GENERATION,
          UsagePeriodType.DAILY
        )
      ).resolves.toBe(1);
      expect(requests).toHaveLength(1);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('does not call OpenAI when AI_DAILY_PLAN_GENERATION limit is already reached', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'OpenAiBlocked',
              isMinor: false
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-ai-limit@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'OpenAiBlocked');
      await customCtx.app.get(UsageLedgerService).incrementUsage(
        user.user.id,
        UsageFeature.AI_DAILY_PLAN_GENERATION,
        UsagePeriodType.DAILY
      );

      const blocked = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: false })
        .expect(429);

      expect(blocked.body).toMatchObject({
        code: 'USAGE_LIMIT_REACHED',
        feature: UsageFeature.AI_DAILY_PLAN_GENERATION,
        currentPlan: SubscriptionPlan.FREE
      });
      expect(requests).toHaveLength(0);
      await expect(
        customCtx.app.get(UsageLedgerService).getUsage(
          user.user.id,
          UsageFeature.DAILY_PLAN_GENERATION,
          UsagePeriodType.DAILY
        )
      ).resolves.toBe(0);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('counts OpenAI fallback as usage once generation starts', async () => {
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify({ summary: { title: 'Invalid only' } })
        }),
        () => ({
          output_text: JSON.stringify({ summary: { title: 'Still invalid' } })
        })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-fallback-counts@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'OpenAiFallbackUsage');

      const response = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: false })
        .expect(201);

      expect(response.body.status).toBe('FALLBACK');
      await expect(
        customCtx.app.get(UsageLedgerService).getUsage(
          user.user.id,
          UsageFeature.DAILY_PLAN_GENERATION,
          UsagePeriodType.DAILY
        )
      ).resolves.toBe(1);
      await expect(
        customCtx.app.get(UsageLedgerService).getUsage(
          user.user.id,
          UsageFeature.AI_DAILY_PLAN_GENERATION,
          UsagePeriodType.DAILY
        )
      ).resolves.toBe(1);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('varies OpenAI prompt and planning context by PlanQualityMode', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'BasicOpenAI',
              isMinor: false
            })
          )
        }),
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'PersonalizedOpenAI',
              isMinor: false
            })
          )
        }),
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'AdaptiveOpenAI',
              isMinor: false
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const freeUser = await registerTestUser(customCtx.app, 'openai-basic-mode@example.com');
      const plusUser = await registerTestUser(
        customCtx.app,
        'openai-personalized-mode@example.com'
      );
      const proUser = await registerTestUser(customCtx.app, 'openai-adaptive-mode@example.com');
      await completeRequiredOnboarding(customCtx.app, freeUser.accessToken, 'BasicOpenAI');
      await completeRequiredOnboarding(customCtx.app, plusUser.accessToken, 'PersonalizedOpenAI');
      await completeRequiredOnboarding(customCtx.app, proUser.accessToken, 'AdaptiveOpenAI');
      await createTestSubscription(customCtx, plusUser.user.id, {
        plan: SubscriptionPlan.PLUS,
        status: SubscriptionStatus.ACTIVE
      });
      await createTestSubscription(customCtx, proUser.user.id, {
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE
      });

      for (const user of [freeUser, plusUser, proUser]) {
        await request(customCtx.app.getHttpServer())
          .post('/v1/daily-plans/generate')
          .set(authHeader(user.accessToken))
          .send({ forceRegenerate: true })
          .expect(201);
      }

      expect(requests).toHaveLength(3);
      const parsedRequests = requests.map(parseOpenAiPlanningRequest);

      expect(parsedRequests[0].system).toContain('PlanQualityMode is BASIC');
      expect(parsedRequests[0].system).toContain('Return exactly 1 nutrition.menuOptions');
      expect(parsedRequests[0].system).toContain('For BASIC, include 0-2 simple');
      expect(parsedRequests[0].context.planQualityMode).toBe('BASIC');
      expect(parsedRequests[0].context.personalizationContext.contextLevel).toBe('minimal');
      expect(
        parsedRequests[0].context.personalizationContext.trainingPersonalization.exerciseDetailLevel
      ).toBe('simple');

      expect(parsedRequests[1].system).toContain('PlanQualityMode is PERSONALIZED');
      expect(parsedRequests[1].system).toContain('Return exactly 2 nutrition.menuOptions');
      expect(parsedRequests[1].system).toContain('sets, reps, and rest');
      expect(parsedRequests[1].system).toContain('For PERSONALIZED, include 3-4 exercises');
      expect(parsedRequests[1].context.planQualityMode).toBe('PERSONALIZED');
      expect(parsedRequests[1].context.personalizationContext.contextLevel).toBe('personalized');
      expect(
        parsedRequests[1].context.personalizationContext.trainingPersonalization.exerciseDetailLevel
      ).toBe('sets_reps_rest');

      expect(parsedRequests[2].system).toContain('PlanQualityMode is ADAPTIVE');
      expect(parsedRequests[2].system).toContain('Return exactly 3 nutrition.menuOptions');
      expect(parsedRequests[2].system).toContain('readiness placeholders');
      expect(parsedRequests[2].system).toContain('For ADAPTIVE, include 4-5 individualized exercises');
      expect(parsedRequests[2].context.planQualityMode).toBe('ADAPTIVE');
      expect(parsedRequests[2].context.personalizationContext.contextLevel).toBe('adaptive');
      expect(
        parsedRequests[2].context.personalizationContext.trainingPersonalization.futureSignals
      ).toContain('whoopRecovery');
      expect(
        parsedRequests[2].context.personalizationContext.trainingPersonalization.exerciseDetailLevel
      ).toBe('adaptive');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('passes gender and pregnancyStatus as careful safety context to OpenAI planning', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'PregnancyOpenAI',
              isMinor: false,
              planQualityMode: PlanQualityMode.BASIC
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-pregnancy-context@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'PregnancyOpenAI');
      await request(customCtx.app.getHttpServer())
        .put('/v1/profile')
        .set(authHeader(user.accessToken))
        .send({
          firstName: 'PregnancyOpenAI',
          gender: 'female',
          pregnancyStatus: PregnancyStatus.PREGNANT,
          dateOfBirth: '1990-01-01',
          heightCm: 170,
          weightKg: 70,
          activityLevel: 'MODERATE',
          privacyConsentAccepted: true
        })
        .expect(200);

      await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      const parsedRequest = parseOpenAiPlanningRequest(requests[0]);

      expect(parsedRequest.system).toContain('do not stereotype nutrition or training by gender');
      expect(parsedRequest.system).toContain('Do not assume pregnancy');
      expect(parsedRequest.system).toContain('If pregnancyStatus is PREGNANT');
      expect(parsedRequest.context.profile?.gender).toBe('female');
      expect(parsedRequest.context.profile?.pregnancyStatus).toBe(PregnancyStatus.PREGNANT);
      expect(parsedRequest.context.safetyConstraints.pregnancyStatus).toBe(
        PregnancyStatus.PREGNANT
      );
      expect(
        parsedRequest.context.safetyConstraints
          .pregnancySensitiveStatusRequiresConservativeGuidance
      ).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('respects OpenAI timeout and max output token config', async () => {
    const previousTimeout = process.env.OPENAI_REQUEST_TIMEOUT_MS;
    const previousMaxTokens = process.env.OPENAI_MAX_OUTPUT_TOKENS;
    process.env.OPENAI_REQUEST_TIMEOUT_MS = '12345';
    process.env.OPENAI_MAX_OUTPUT_TOKENS = '2345';
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'Config',
              isMinor: false
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-config@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'Config');

      await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(requests[0].max_output_tokens).toBe(2345);
      expect(requests[0].requestTimeout).toBe(12345);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined, previousTimeout, previousMaxTokens);
    }
  });

  it('retries once when OpenAI returns invalid output, then accepts valid DailyPlanJson', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify({ schemaVersion: 'wrong' }) }),
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'Retry',
              isMinor: false
            })
          )
        })
      ],
      requests
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-retry@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'Retry');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.summary.message).toContain('Retry');
      expect(plan.body.plan.debug.provider).toBe('openai');
      expect(requests).toHaveLength(2);
      expect(JSON.stringify(requests[1])).toContain('This is a retry');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('normalizes invalid OpenAI generatedAt metadata and returns READY', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'InvalidGeneratedAt',
      isMinor: false
    });
    openAiPlan.generatedAt = 'not-a-date';

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-invalid-generated-at@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'InvalidGeneratedAt');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.generatedAt).not.toBe('not-a-date');
      expect(plan.body.plan.mockVersion).toBe(0);
      expect(plan.body.plan.debug.provider).toBe('openai');
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('normalizes missing OpenAI generatedAt and debug metadata and returns READY', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'MissingMetadata',
      isMinor: false
    }) as Record<string, unknown>;
    delete openAiPlan.generatedAt;
    delete openAiPlan.debug;

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-missing-metadata@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'MissingMetadata');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.generatedAt).toBeTruthy();
      expect(plan.body.plan.mockVersion).toBe(0);
      expect(plan.body.plan.debug).toMatchObject({
        provider: 'openai',
        generatedBy: 'OpenAiProviderService',
        planQualityMode: 'BASIC'
      });
      expect(dailyPlanJsonSchema.safeParse(plan.body.plan).success).toBe(true);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('falls back when OpenAI content structure is genuinely invalid', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'InvalidStructure',
      isMinor: false
    }) as Record<string, unknown>;
    openAiPlan.nutrition = { meals: 'not-valid' };
    openAiPlan.training = { intensity: 'EXTREME' };

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) }), () => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-invalid-structure@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'InvalidStructure');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe('schema_validation_failed');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('falls back safely when OpenAI output is invalid after retry', async () => {
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({ output_text: JSON.stringify({ schemaVersion: 'wrong' }) }),
        () => ({ output_text: 'not json' })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-invalid@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'InvalidOpenAI');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.schemaVersion).toBe('sprint-2.v1');
      expect(plan.body.plan.debug).toMatchObject({
        provider: 'fallback',
        generatedBy: 'SafeFallbackPlanFactory',
        fallbackReason: 'json_parse_failed',
        planQualityMode: 'BASIC'
      });
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('still runs SafetyService after OpenAI provider output', async () => {
    const customCtx = await createOpenAiModeTestApp({
      responses: [
        () => ({
          output_text: JSON.stringify(
            createMockDailyPlan({
              planLocalDate: getUtcLocalDate(),
              planTimezone: 'UTC',
              firstName: 'UnsafeFood',
              isMinor: false
            })
          )
        })
      ]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-safety@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'UnsafeFood');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['Greek yogurt'],
          excludedFoods: [],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(JSON.stringify(plan.body.plan)).not.toContain('Greek yogurt');
      expect(JSON.stringify(plan.body.plan)).toContain('conflicts with your allergies');
      expect(plan.body.plan.debug.fallbackReason).toContain('conflicts with your allergies');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('allows OpenAI allergy mentions that only say the food is avoided', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'AvoidAllergy',
      isMinor: false
    });
    openAiPlan.reminders = ['Avoid avocado today because it is listed as an allergy.'];
    openAiPlan.nutrition.meals[0].foods[0].notes = 'Add variety and fiber, avoiding avocado.';

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-avoid-allergy@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'AvoidAllergy');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['avocado'],
          excludedFoods: [],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.provider).toBe('openai');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('normalizes OpenAI food names with safe avoidance qualifiers before safety checks', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'NormalizeFoodName',
      isMinor: false
    });
    openAiPlan.nutrition.meals[0].foods[0].name = 'Mixed salad (no avocado, no broccoli)';

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-normalize-food-name@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'NormalizeFoodName');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          allergies: ['avocado'],
          excludedFoods: ['broccoli'],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.nutrition.meals[0].foods[0].name).toBe('Mixed salad');
      expect(plan.body.plan.nutrition.meals[0].foods[0].notes).toContain(
        'Prepared without avocado and broccoli.'
      );
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('allows OpenAI reminders that only say an excluded food is avoided', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'AvoidExcluded',
      isMinor: false
    });
    openAiPlan.reminders = ['This plan avoids pork as requested.'];

    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ output_text: JSON.stringify(openAiPlan) })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app, 'openai-avoid-excluded@example.com');
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'AvoidExcluded');

      await request(customCtx.app.getHttpServer())
        .put('/v1/nutrition-preferences')
        .set(authHeader(user.accessToken))
        .send({
          dietType: 'NONE',
          mealsPerDay: 3,
          noKnownAllergiesConfirmed: true,
          allergies: [],
          excludedFoods: ['pork'],
          preferredFoods: ['rice']
        })
        .expect(200);

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('READY');
      expect(plan.body.plan.debug.provider).toBe('openai');
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });

  it('blocks allergies in meal food names and recommended notes', async () => {
    const openAiPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'AllergyConflict',
      isMinor: false
    });
    openAiPlan.nutrition.meals[0].foods[0].name = 'Avocado toast';

    const noteConflictPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'AllergyNoteConflict',
      isMinor: false
    });
    noteConflictPlan.nutrition.meals[0].foods[0].notes = 'Serve with avocado on top.';

    for (const [email, planJson] of [
      ['openai-allergy-name-conflict@example.com', openAiPlan],
      ['openai-allergy-note-conflict@example.com', noteConflictPlan]
    ] as const) {
      const customCtx = await createOpenAiModeTestApp({
        responses: [() => ({ output_text: JSON.stringify(planJson) })]
      });

      try {
        await cleanupDatabase(customCtx.prisma);
        const user = await registerTestUser(customCtx.app, email);
        await completeRequiredOnboarding(customCtx.app, user.accessToken, 'AllergyConflict');

        await request(customCtx.app.getHttpServer())
          .put('/v1/nutrition-preferences')
          .set(authHeader(user.accessToken))
          .send({
            dietType: 'NONE',
            mealsPerDay: 3,
            allergies: ['avocado'],
            excludedFoods: [],
            preferredFoods: ['rice']
          })
          .expect(200);

        const plan = await request(customCtx.app.getHttpServer())
          .post('/v1/daily-plans/generate')
          .set(authHeader(user.accessToken))
          .send({ forceRegenerate: true })
          .expect(201);

        expect(plan.body.status).toBe('FALLBACK');
        expect(plan.body.plan.debug.fallbackReason).toContain('conflicts with your allergies');
      } finally {
        await cleanupDatabase(customCtx.prisma);
        await customCtx.app.close();
        restoreOpenAiEnv(undefined, undefined, undefined);
      }
    }
  });

  it('blocks excluded foods in meal food names but allows avoid notes', async () => {
    const conflictPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'ExcludedConflict',
      isMinor: false
    });
    conflictPlan.nutrition.meals[0].foods[0].name = 'Pork rice bowl';

    const allowedPlan = createMockDailyPlan({
      planLocalDate: getUtcLocalDate(),
      planTimezone: 'UTC',
      firstName: 'ExcludedAvoid',
      isMinor: false
    });
    allowedPlan.nutrition.meals[0].foods[0].notes = 'Avoid pork and use chicken instead.';

    for (const [email, planJson, expectedStatus] of [
      ['openai-excluded-name-conflict@example.com', conflictPlan, 'FALLBACK'],
      ['openai-excluded-avoid-note@example.com', allowedPlan, 'READY']
    ] as const) {
      const customCtx = await createOpenAiModeTestApp({
        responses: [() => ({ output_text: JSON.stringify(planJson) })]
      });

      try {
        await cleanupDatabase(customCtx.prisma);
        const user = await registerTestUser(customCtx.app, email);
        await completeRequiredOnboarding(customCtx.app, user.accessToken, 'ExcludedFood');

        await request(customCtx.app.getHttpServer())
          .put('/v1/nutrition-preferences')
          .set(authHeader(user.accessToken))
          .send({
            dietType: 'NONE',
            mealsPerDay: 3,
            noKnownAllergiesConfirmed: true,
            allergies: [],
            excludedFoods: ['pork'],
            preferredFoods: ['rice']
          })
          .expect(200);

        const plan = await request(customCtx.app.getHttpServer())
          .post('/v1/daily-plans/generate')
          .set(authHeader(user.accessToken))
          .send({ forceRegenerate: true })
          .expect(201);

        expect(plan.body.status).toBe(expectedStatus);
      } finally {
        await cleanupDatabase(customCtx.prisma);
        await customCtx.app.close();
        restoreOpenAiEnv(undefined, undefined, undefined);
      }
    }
  });

  it.each([
    [
      'maps OpenAI auth errors to fallback reason',
      { name: 'AuthenticationError', message: 'Invalid API key', status: 401, code: 'invalid_api_key' },
      'openai_auth_error'
    ],
    [
      'maps OpenAI invalid model errors to fallback reason',
      { name: 'BadRequestError', message: 'Model does not exist', status: 400, code: 'model_not_found' },
      'openai_invalid_model'
    ],
    [
      'maps OpenAI rate limit errors to fallback reason',
      { name: 'RateLimitError', message: 'Rate limit reached', status: 429, code: 'rate_limit_exceeded' },
      'openai_rate_limited'
    ],
    [
      'maps OpenAI timeout errors to fallback reason',
      { name: 'APIConnectionTimeoutError', message: 'Request timeout', code: 'ETIMEDOUT' },
      'openai_timeout'
    ]
  ])('%s', async (_name, sdkError, expectedReason) => {
    const customCtx = await createOpenAiModeTestApp({
      responses: [() => ({ throw: sdkError }), () => ({ throw: sdkError })]
    });

    try {
      await cleanupDatabase(customCtx.prisma);
      const user = await registerTestUser(customCtx.app);
      await completeRequiredOnboarding(customCtx.app, user.accessToken, 'OpenAiError');

      const plan = await request(customCtx.app.getHttpServer())
        .post('/v1/daily-plans/generate')
        .set(authHeader(user.accessToken))
        .send({ forceRegenerate: true })
        .expect(201);

      expect(plan.body.status).toBe('FALLBACK');
      expect(plan.body.plan.debug.fallbackReason).toBe(expectedReason);
    } finally {
      await cleanupDatabase(customCtx.prisma);
      await customCtx.app.close();
      restoreOpenAiEnv(undefined, undefined, undefined);
    }
  });
});

async function completeRequiredOnboarding(app: TestApp['app'], token: string, firstName = 'Alex') {
  await request(app.getHttpServer())
    .put('/v1/profile')
    .set(authHeader(token))
    .send({
      firstName,
      lastName: 'User',
      gender: 'female',
      dateOfBirth: '1990-01-01',
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'MODERATE',
      privacyConsentAccepted: true
    })
    .expect(200);

  await request(app.getHttpServer())
    .put('/v1/goals')
    .set(authHeader(token))
    .send({
      goalType: 'IMPROVE_FITNESS'
    })
    .expect(200);

  await request(app.getHttpServer())
    .put('/v1/nutrition-preferences')
    .set(authHeader(token))
    .send({
      dietType: 'NONE',
      mealsPerDay: 3,
      allergies: ['peanuts'],
      excludedFoods: ['shellfish'],
      preferredFoods: ['rice', 'eggs']
    })
    .expect(200);

  await request(app.getHttpServer())
    .post('/v1/training-schedule/items')
    .set(authHeader(token))
    .send({
      dayOfWeek: 1,
      localTime: '07:30',
      sportType: 'RUNNING',
      durationMinutes: 30,
      intensity: 'MODERATE',
      description: 'Easy run'
    })
    .expect(201);
}

async function completeStage1BasicsWithoutGoal(
  app: TestApp['app'],
  token: string,
  firstName = 'StageOne'
) {
  await request(app.getHttpServer())
    .put('/v1/profile')
    .set(authHeader(token))
    .send({
      firstName,
      lastName: 'User',
      gender: 'female',
      pregnancyStatus: PregnancyStatus.UNKNOWN,
      dateOfBirth: '1990-01-01',
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'MODERATE',
      privacyConsentAccepted: true
    })
    .expect(200);

  await request(app.getHttpServer())
    .put('/v1/nutrition-preferences')
    .set(authHeader(token))
    .send({
      noKnownAllergiesConfirmed: true
    })
    .expect(200);

  await request(app.getHttpServer())
    .put('/v1/training-schedule/intent')
    .set(authHeader(token))
    .send({ noTrainingPlanned: true })
    .expect(200);
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function baseProtocolInput(overrides: Partial<ProtocolSelectionInput> = {}): ProtocolSelectionInput {
  return {
    profile: { pregnancyStatus: PregnancyStatus.UNKNOWN },
    goal: {
      goalType: GoalType.IMPROVE_FITNESS,
      targetWeightKg: null,
      targetTimelineDays: null,
      impactMode: null
    },
    safeMode: false,
    isMinor: false,
    noTrainingPlanned: false,
    trainingSchedule: [
      {
        durationMinutes: 30,
        intensity: 'MODERATE',
        description: 'Easy run'
      }
    ],
    trainingPreference: {
      trainingOutcome: TrainingOutcome.GENERAL_FITNESS,
      equipment: [TrainingEquipment.GYM],
      trainingLevel: TrainingLevel.INTERMEDIATE,
      limitationsOrPainAreas: []
    },
    checkInSummary: {
      recentAverageTiredness: 2,
      painOrDiscomfortReported: false,
      highTirednessReported: false,
      conservativeTrainingRecommended: false
    },
    planQualityMode: PlanQualityMode.PERSONALIZED,
    ...overrides
  };
}

function createTestSubscription(
  ctx: TestApp,
  userId: string,
  overrides: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    startsAt?: Date;
    expiresAt?: Date | null;
    canceledAt?: Date | null;
  }
) {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return ctx.prisma.subscription.create({
    data: {
      userId,
      plan: overrides.plan,
      status: overrides.status,
      provider: SubscriptionProvider.DEV,
      environment: SubscriptionEnvironment.SANDBOX,
      providerCustomerId: `dev-customer-${uniqueSuffix}`,
      providerSubscriptionId: `dev-subscription-${uniqueSuffix}`,
      providerTransactionId: `dev-transaction-${uniqueSuffix}`,
      originalTransactionId: `dev-original-${uniqueSuffix}`,
      providerProductId: `dev-${overrides.plan.toLowerCase()}`,
      startsAt: overrides.startsAt ?? daysFromNow(-1),
      expiresAt: overrides.expiresAt === undefined ? daysFromNow(30) : overrides.expiresAt,
      canceledAt: overrides.canceledAt ?? null
    }
  });
}

function expectedFeaturesForPlan(plan: SubscriptionPlan | 'FREE' | 'PLUS' | 'PRO') {
  const isPlusOrPro = plan === 'PLUS' || plan === 'PRO';
  const isPro = plan === 'PRO';

  return {
    canGenerateDailyPlan: true,
    canRefreshPlan: true,
    canUseOpenAIProvider: true,
    canUseAdvancedPersonalization: isPlusOrPro,
    canUseFeedbackPersonalization: isPlusOrPro,
    canViewHistory: true,
    canSubmitFeedback: true,
    canUseWeeklyReports: isPlusOrPro,
    canUseWhoop: isPro,
    canUseAiCoach: isPro
  };
}

function parseOpenAiPlanningRequest(requestInput: Record<string, unknown>) {
  const input = requestInput.input as Array<{ content?: string }>;

  return {
    system: input[0].content ?? '',
      context: JSON.parse(input[1].content ?? '{}') as {
      planQualityMode?: string;
      profile?: {
        gender?: string | null;
        pregnancyStatus?: string;
      } | null;
      safetyConstraints: {
        pregnancyStatus?: string;
        pregnancySensitiveStatusRequiresConservativeGuidance?: boolean;
      };
      personalizationContext: {
        contextLevel: string;
        trainingPersonalization: {
          exerciseDetailLevel: string;
          futureSignals: string[];
        };
      };
    }
  };
}

function getUtcLocalDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function restoreOpenAiEnv(
  aiProvider: string | undefined,
  apiKey: string | undefined,
  defaultModel?: string | undefined,
  requestTimeoutMs?: string | undefined,
  maxOutputTokens?: string | undefined
) {
  if (aiProvider === undefined) {
    delete process.env.AI_PROVIDER;
  } else {
    process.env.AI_PROVIDER = aiProvider;
  }

  if (apiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = apiKey;
  }

  if (defaultModel === undefined) {
    delete process.env.OPENAI_DEFAULT_MODEL;
  } else {
    process.env.OPENAI_DEFAULT_MODEL = defaultModel;
  }

  if (requestTimeoutMs === undefined) {
    delete process.env.OPENAI_REQUEST_TIMEOUT_MS;
  } else {
    process.env.OPENAI_REQUEST_TIMEOUT_MS = requestTimeoutMs;
  }

  if (maxOutputTokens === undefined) {
    delete process.env.OPENAI_MAX_OUTPUT_TOKENS;
  } else {
    process.env.OPENAI_MAX_OUTPUT_TOKENS = maxOutputTokens;
  }
}

function restoreSafetyAgentEnv(enabled: string | undefined, provider: string | undefined) {
  if (enabled === undefined) {
    delete process.env.SAFETY_AGENT_ENABLED;
  } else {
    process.env.SAFETY_AGENT_ENABLED = enabled;
  }

  if (provider === undefined) {
    delete process.env.SAFETY_AGENT_PROVIDER;
  } else {
    process.env.SAFETY_AGENT_PROVIDER = provider;
  }
}

type MockOpenAiResponse = { output_text?: string } | { throw: unknown };

async function createOpenAiModeTestApp(options: {
  responses: Array<() => MockOpenAiResponse>;
  requests?: Array<Record<string, unknown>>;
}) {
  process.env.AI_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_DEFAULT_MODEL = 'test-openai-model';

  let callIndex = 0;

  return createTestApp({
    providerOverrides: [
      {
        token: OPENAI_CLIENT_FACTORY,
        value: () => ({
          responses: {
            create: async (input: Record<string, unknown>, requestOptions?: Record<string, unknown>) => {
              options.requests?.push(input);
              const response = options.responses[Math.min(callIndex, options.responses.length - 1)]();
              callIndex += 1;
              if ('throw' in response) {
                throw response.throw;
              }
              if (requestOptions?.timeout) {
                input.requestTimeout = requestOptions.timeout;
              }
              return response;
            }
          }
        })
      }
    ]
  });
}

async function createOpenAiSafetyAgentModeTestApp(options: {
  responses: Array<() => MockOpenAiResponse>;
  requests?: Array<Record<string, unknown>>;
}) {
  delete process.env.AI_PROVIDER;
  process.env.SAFETY_AGENT_ENABLED = 'true';
  process.env.SAFETY_AGENT_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_DEFAULT_MODEL = 'test-openai-model';

  let callIndex = 0;

  return createTestApp({
    providerOverrides: [
      {
        token: OPENAI_CLIENT_FACTORY,
        value: () => ({
          responses: {
            create: async (input: Record<string, unknown>, requestOptions?: Record<string, unknown>) => {
              options.requests?.push(input);
              const response = options.responses[Math.min(callIndex, options.responses.length - 1)]();
              callIndex += 1;
              if ('throw' in response) {
                throw response.throw;
              }
              if (requestOptions?.timeout) {
                input.requestTimeout = requestOptions.timeout;
              }
              return response;
            }
          }
        })
      }
    ]
  });
}

async function createOpenAiDailyAndSafetyAgentModeTestApp(options: {
  responses: Array<() => MockOpenAiResponse>;
  requests?: Array<Record<string, unknown>>;
}) {
  process.env.AI_PROVIDER = 'openai';
  process.env.SAFETY_AGENT_ENABLED = 'true';
  process.env.SAFETY_AGENT_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_DEFAULT_MODEL = 'test-openai-model';

  let callIndex = 0;

  return createTestApp({
    providerOverrides: [
      {
        token: OPENAI_CLIENT_FACTORY,
        value: () => ({
          responses: {
            create: async (input: Record<string, unknown>, requestOptions?: Record<string, unknown>) => {
              options.requests?.push(input);
              const response = options.responses[Math.min(callIndex, options.responses.length - 1)]();
              callIndex += 1;
              if ('throw' in response) {
                throw response.throw;
              }
              if (requestOptions?.timeout) {
                input.requestTimeout = requestOptions.timeout;
              }
              return response;
            }
          }
        })
      }
    ]
  });
}
