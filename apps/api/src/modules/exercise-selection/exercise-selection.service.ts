import { Injectable } from '@nestjs/common';
import {
  ExerciseCategory,
  ExerciseContraindicationTag,
  ExerciseEquipment,
  MovementPattern,
  PregnancyStatus,
  TrainingLevel
} from '@prisma/client';

import { ExercisesService } from '../exercises/exercises.service';
import { normalizeLegacyTargetMuscles } from './legacy-muscle-normalizer';
import type {
  ExerciseCandidate,
  ExerciseExclusionReason,
  ExerciseSelectionContext,
  ExerciseSelectionFallbackMode,
  ExerciseSelectionReason,
  ExerciseSelectionResult
} from './exercise-selection.types';

const SCORE = {
  EXACT_TARGET: 100,
  SECONDARY_TARGET: 35,
  PATTERN: 30,
  CATEGORY: 25,
  EQUIPMENT: 12,
  LEVEL: 10,
  LOW_COMPLEXITY: 6,
  RECOVERY: 70,
  ACCESSIBLE_MOVEMENT: 20
} as const;

const UNIVERSAL_EQUIPMENT = new Set<ExerciseEquipment>([
  ExerciseEquipment.NONE,
  ExerciseEquipment.BODYWEIGHT
]);
const LEVEL_RANK: Record<TrainingLevel, number> = {
  [TrainingLevel.BEGINNER]: 0,
  [TrainingLevel.INTERMEDIATE]: 1,
  [TrainingLevel.ADVANCED]: 2
};
const HIGH_COMPLEXITY_PATTERNS = new Set<MovementPattern>([
  MovementPattern.CARRY,
  MovementPattern.ROTATION
]);
const POSTPARTUM_STATUSES = new Set<PregnancyStatus>([
  PregnancyStatus.POSTPARTUM,
  PregnancyStatus.BREASTFEEDING
]);
const RECOVERY_CATEGORIES = new Set<ExerciseCategory>([
  ExerciseCategory.MOBILITY,
  ExerciseCategory.RECOVERY
]);
const ACCESSIBLE_MOVEMENT_CATEGORIES = new Set<ExerciseCategory>([
  ExerciseCategory.CARDIO,
  ExerciseCategory.MOBILITY
]);

@Injectable()
export class ExerciseSelectionService {
  constructor(private readonly exercisesService: ExercisesService) {}

  async selectCandidates(context: ExerciseSelectionContext): Promise<ExerciseSelectionResult> {
    const normalizedTargetMuscles = normalizeLegacyTargetMuscles(context.targetMuscles);
    const requestedExerciseCount = this.getRequestedExerciseCount(context);
    const candidatePoolLimit = Math.min(16, Math.max(6, requestedExerciseCount * 2));
    const records = await this.exercisesService.getActiveForSelection(context.locale);
    const exclusions: Partial<Record<ExerciseExclusionReason, number>> = {};
    const eligible = records.filter((record) => {
      const reason = this.getExclusionReason(record, context);
      if (reason) exclusions[reason] = (exclusions[reason] ?? 0) + 1;
      return !reason;
    });
    const ranked = eligible
      .map((record) => this.score(record, context, normalizedTargetMuscles))
      .sort((left, right) => right.internalScore - left.internalScore || left.sortOrder - right.sortOrder || left.slug.localeCompare(right.slug));
    const covered = this.ensureTargetCoverage(ranked, normalizedTargetMuscles);
    const candidates = covered.slice(0, candidatePoolLimit).map(({ sortOrder: _sortOrder, ...candidate }) => candidate);

    return {
      candidates,
      requestedExerciseCount: Math.min(requestedExerciseCount, candidates.length),
      candidatePoolLimit,
      workoutDurationMinutes: context.workoutDurationMinutes ?? 30,
      normalizedTargetMuscles,
      fallbackMode: this.getFallbackMode(context, candidates.length),
      internalExclusionSummary: exclusions
    };
  }

  private getExclusionReason(
    record: Awaited<ReturnType<ExercisesService['getActiveForSelection']>>[number],
    context: ExerciseSelectionContext
  ): ExerciseExclusionReason | null {
    const available = new Set(context.availableEquipment);
    const equipmentAllowed = record.equipment.every((item) => UNIVERSAL_EQUIPMENT.has(item) || available.has(item));
    if (!equipmentAllowed) return 'EQUIPMENT_UNAVAILABLE';

    const userRank = LEVEL_RANK[context.trainingLevel];
    if (!record.trainingLevels.some((level) => LEVEL_RANK[level] <= userRank)) return 'LEVEL_UNSUPPORTED';

    if (
      context.pregnancyStatus === PregnancyStatus.PREGNANT &&
      record.contraindicationTags.includes(ExerciseContraindicationTag.PREGNANCY_REVIEW)
    ) return 'PREGNANCY_REVIEW_REQUIRED';

    if (
      context.pregnancyStatus != null && POSTPARTUM_STATUSES.has(context.pregnancyStatus) &&
      record.contraindicationTags.includes(ExerciseContraindicationTag.POSTPARTUM_REVIEW)
    ) return 'POSTPARTUM_REVIEW_REQUIRED';

    if (
      (context.safeMode || context.isMinor || context.limitationsPresent || context.healthSignals.lowSleep || context.healthSignals.highActivity) &&
      record.contraindicationTags.includes(ExerciseContraindicationTag.HIGH_IMPACT)
    ) return 'HIGH_IMPACT_RECOVERY_CONTEXT';

    return null;
  }

  private score(
    record: Awaited<ReturnType<ExercisesService['getActiveForSelection']>>[number],
    context: ExerciseSelectionContext,
    targets: ExerciseSelectionContext['targetMuscles']
  ): ExerciseCandidate & { sortOrder: number } {
    let internalScore = 0;
    const reasons: ExerciseSelectionReason[] = [];
    const exactMatches = record.targetMuscles.filter((muscle) => targets.includes(muscle)).length;
    const secondaryMatches = record.secondaryMuscles.filter((muscle) => targets.includes(muscle)).length;
    if (exactMatches) { internalScore += exactMatches * SCORE.EXACT_TARGET; reasons.push('EXACT_TARGET_MATCH'); }
    if (secondaryMatches) { internalScore += secondaryMatches * SCORE.SECONDARY_TARGET; reasons.push('SECONDARY_TARGET_MATCH'); }

    const preferredCategories = this.getPreferredCategories(context.protocol.id);
    if (preferredCategories.includes(record.category)) { internalScore += SCORE.CATEGORY; reasons.push('PROTOCOL_CATEGORY_MATCH'); }
    if (this.getPreferredPatterns(context.protocol.id).includes(record.movementPattern)) { internalScore += SCORE.PATTERN; reasons.push('PATTERN_MATCH'); }
    internalScore += SCORE.EQUIPMENT; reasons.push('EQUIPMENT_MATCH');
    internalScore += SCORE.LEVEL; reasons.push('LEVEL_MATCH');

    if (!HIGH_COMPLEXITY_PATTERNS.has(record.movementPattern) && record.trainingLevels.includes(TrainingLevel.BEGINNER)) {
      internalScore += SCORE.LOW_COMPLEXITY;
      reasons.push('LOW_COMPLEXITY_PREFERENCE');
    }
    if ((context.healthSignals.lowSleep || context.healthSignals.highActivity || context.limitationsPresent) &&
      RECOVERY_CATEGORIES.has(record.category)) {
      internalScore += SCORE.RECOVERY; reasons.push('HEALTH_RECOVERY_PREFERENCE');
    }
    if (context.healthSignals.lowStepTrend &&
      (record.slug === 'walking' || ACCESSIBLE_MOVEMENT_CATEGORIES.has(record.category))) {
      internalScore += SCORE.ACCESSIBLE_MOVEMENT; reasons.push('LOW_STEP_ACCESSIBLE_MOVEMENT');
    }

    return { ...record, internalScore, internalReasonCodes: reasons, sortOrder: record.sortOrder };
  }

  private ensureTargetCoverage<T extends ExerciseCandidate & { sortOrder: number }>(ranked: T[], targets: ExerciseSelectionContext['targetMuscles']) {
    const prioritized: T[] = [];
    const used = new Set<string>();
    for (const target of targets) {
      const match = ranked.find((candidate) => !used.has(candidate.exerciseId) && candidate.targetMuscles.includes(target));
      if (match) { prioritized.push(match); used.add(match.exerciseId); }
    }
    return [...prioritized, ...ranked.filter((candidate) => !used.has(candidate.exerciseId))];
  }

  private getRequestedExerciseCount(context: ExerciseSelectionContext) {
    if (context.protocol.id === 'NO_TRAINING_PLANNED') return 0;
    const duration = context.workoutDurationMinutes ?? 30;
    let count = duration <= 20 ? 3 : duration <= 35 ? 4 : duration <= 50 ? 5 : 6;
    if (context.healthSignals.lowSleep || context.healthSignals.highActivity || context.limitationsPresent) count = Math.max(2, count - 1);
    if (['NO_TRAINING_PLANNED', 'RECOVERY', 'CONSERVATIVE_PAIN_LIMITATION'].includes(context.protocol.id)) count = Math.min(count, 3);
    return count;
  }

  private getFallbackMode(context: ExerciseSelectionContext, count: number): ExerciseSelectionFallbackMode {
    if (context.healthSignals.lowSleep || context.healthSignals.highActivity || context.limitationsPresent ||
      ['RECOVERY', 'CONSERVATIVE_PAIN_LIMITATION', 'NO_TRAINING_PLANNED'].includes(context.protocol.id)) return 'RECOVERY_FOCUSED';
    if (context.availableEquipment.length === 0) return 'BODYWEIGHT_ONLY';
    if (count < 6) return 'MINIMAL_SAFE_POOL';
    return 'NONE';
  }

  private getPreferredCategories(protocolId: string): ExerciseCategory[] {
    if (['RECOVERY', 'NO_TRAINING_PLANNED', 'CONSERVATIVE_PAIN_LIMITATION'].includes(protocolId)) return [ExerciseCategory.RECOVERY, ExerciseCategory.MOBILITY];
    if (protocolId === 'MOBILITY') return [ExerciseCategory.MOBILITY, ExerciseCategory.RECOVERY];
    if (protocolId === 'ENDURANCE') return [ExerciseCategory.CARDIO];
    return [ExerciseCategory.STRENGTH];
  }

  private getPreferredPatterns(protocolId: string): MovementPattern[] {
    if (protocolId === 'ENDURANCE') return [MovementPattern.CARDIO];
    if (['MOBILITY', 'RECOVERY', 'NO_TRAINING_PLANNED', 'CONSERVATIVE_PAIN_LIMITATION'].includes(protocolId)) return [MovementPattern.MOBILITY, MovementPattern.RECOVERY];
    return [MovementPattern.SQUAT, MovementPattern.HINGE, MovementPattern.HORIZONTAL_PUSH, MovementPattern.HORIZONTAL_PULL, MovementPattern.VERTICAL_PUSH, MovementPattern.VERTICAL_PULL, MovementPattern.LUNGE, MovementPattern.CORE_STABILITY];
  }
}
