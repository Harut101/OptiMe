import { Injectable, Logger } from '@nestjs/common';

import { withRecoveryAwareContextNotes } from '../daily-plans/daily-plan-context-notes';
import type { DailyPlanJson } from '../daily-plans/daily-plan-json.schema';
import type { RecoveryProtocolId } from '../protocol/protocol.types';
import type {
  FinalizeRecoveryPlanInput,
  FinalizedRecoveryPlan,
  RecoveryPlanAgent,
  RecoveryPlanMode
} from './recovery-plan-agent.interface';

const CONSERVATIVE_PROTOCOLS = new Set<RecoveryProtocolId>([
  'PAIN_OR_DISCOMFORT',
  'PREGNANCY_POSTPARTUM_CONSERVATIVE'
]);

const GENTLE_PROTOCOLS = new Set<RecoveryProtocolId>([
  'HIGH_TIREDNESS',
  'HIGH_SORENESS'
]);

@Injectable()
export class RecoveryPlanAgentService implements RecoveryPlanAgent {
  private readonly logger = new Logger(RecoveryPlanAgentService.name);

  finalizeGeneratedPlan(input: FinalizeRecoveryPlanInput): FinalizedRecoveryPlan {
    const mode = this.resolveMode(input);
    const withWearableContext = withRecoveryAwareContextNotes(input.planJson, {
      healthPlanningContext: input.healthPlanningContext,
      trainingEnabled: input.trainingEnabled,
      isTrainingDay: input.isTrainingDay
    });
    const planJson = mode === 'NORMAL'
      ? withWearableContext
      : this.ensureConservativeRecoveryContext(withWearableContext, input);
    const contextApplied = planJson.contextNotes !== input.planJson.contextNotes;

    this.logger.log(
      [
        'recovery plan finalized',
        `mode=${mode}`,
        `protocol=${input.recoveryProtocol?.id ?? 'none'}`,
        `wearableDataAvailable=${Boolean(input.healthPlanningContext?.wearablePlanningContext.hasWearableData)}`,
        `contextApplied=${contextApplied}`
      ].join('; ')
    );

    return { planJson, mode, contextApplied };
  }

  private resolveMode(input: FinalizeRecoveryPlanInput): RecoveryPlanMode {
    const protocolId = input.recoveryProtocol?.id;
    if (protocolId && CONSERVATIVE_PROTOCOLS.has(protocolId)) {
      return 'CONSERVATIVE';
    }
    if (protocolId && GENTLE_PROTOCOLS.has(protocolId)) {
      return 'GENTLE';
    }

    const wearable = input.healthPlanningContext?.wearablePlanningContext;
    if (wearable?.hasWearableData && !wearable.isStale) {
      if (
        wearable.sleep.sleepHint === 'LOW_SLEEP' ||
        wearable.activity.activityLevelHint === 'HIGH'
      ) {
        return 'GENTLE';
      }
    }

    return 'NORMAL';
  }

  private ensureConservativeRecoveryContext(
    planJson: DailyPlanJson,
    input: FinalizeRecoveryPlanInput
  ): DailyPlanJson {
    if (planJson.contextNotes?.recovery) {
      return planJson;
    }

    const wearable = input.healthPlanningContext?.wearablePlanningContext;
    return {
      ...planJson,
      contextNotes: {
        ...planJson.contextNotes,
        recovery: {
          titleCode: 'RECOVERY_CONTEXT',
          messageCode: 'GENTLER_RECOVERY_FOCUS',
          reasonCodes: wearable?.hasWearableData && !wearable.isStale
            ? wearable.reasonCodes
            : []
        }
      }
    };
  }
}
