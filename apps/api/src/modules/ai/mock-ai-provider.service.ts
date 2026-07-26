import { Injectable } from '@nestjs/common';

import { createMockDailyPlan } from '../daily-plans/templates/mock-daily-plan.factory';
import { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import {
  AiProvider,
  GenerateDailyPlanInput,
  GeneratePlanCheckpointProposalInput
} from './ai-provider.interface';

@Injectable()
export class MockAiProviderService implements AiProvider {
  async generateDailyPlan(input: GenerateDailyPlanInput) {
    return createMockDailyPlan({
      planLocalDate: input.planLocalDate,
      planTimezone: input.planTimezone,
      locale: input.locale,
      firstName: input.user.firstName,
      isMinor: input.safeMode,
      planQualityMode: input.planQualityMode,
      trainingEnabled: input.personalizationContext.trainingEnabled,
      exerciseSelection: input.exerciseSelection,
      nutritionTarget: input.personalizationContext.nutritionTarget,
      healthPlanningContext: input.personalizationContext.healthPlanningContext
    });
  }

  async generatePlanCheckpointProposal(
    input: GeneratePlanCheckpointProposalInput
  ): Promise<DailyPlanJson> {
    const requiresRecovery =
      input.evaluation.severity === 'HIGH' ||
      input.evaluation.severity === 'SAFETY_CRITICAL';
    const affectsTraining = input.evaluation.affectedSections.includes('TRAINING_PLAN');

    return {
      ...input.currentPlan,
      generatedAt: new Date().toISOString(),
      checkpointBaseline: input.currentFacts,
      summary: {
        ...input.currentPlan.summary,
        readiness: requiresRecovery ? 'RECOVER' : input.currentPlan.summary.readiness,
        message: requiresRecovery
          ? 'Your latest check-in suggests a gentler plan for the rest of today.'
          : 'Your plan can be adjusted to reflect what changed today.'
      },
      training: affectsTraining
        ? {
            ...input.currentPlan.training,
            intensity: requiresRecovery ? 'LIGHT' : input.currentPlan.training.intensity,
            notes: requiresRecovery
              ? 'Keep the session easy and stop if discomfort increases.'
              : input.currentPlan.training.notes
          }
        : input.currentPlan.training,
      reminders: Array.from(
        new Set([
          ...input.currentPlan.reminders,
          'Use this update only if it feels more practical for the rest of today.'
        ])
      ),
      debug: {
        provider: 'mock' as const,
        generatedBy: 'MockAiProviderService' as const,
        planQualityMode: input.planQualityMode
      }
    };
  }
}
