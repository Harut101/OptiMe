import { Injectable } from '@nestjs/common';
import {
  ExerciseCategory,
  ExerciseEquipment,
  TargetMuscleGroup
} from '@prisma/client';

import type { DailyPlanJson } from './daily-plan-json.schema';
import type { ExerciseCandidate, ExerciseSelectionResult } from '../exercise-selection/exercise-selection.types';
import type { WorkoutPainArea } from '../workout-sessions/workout-pain-mapping';

type PlanExercise = NonNullable<DailyPlanJson['training']['exercises']>[number];

export type TrainingReplacementProposalStatus =
  | 'REPLACEMENTS_AVAILABLE'
  | 'PARTIAL_REPLACEMENTS_AVAILABLE'
  | 'NO_SAFE_REPLACEMENTS';

export interface TrainingReplacementProposal {
  originalPlanExerciseKey: string;
  originalExerciseId: string | null;
  originalSlug: string | null;
  originalName: string;
  replacementExerciseId: string;
  replacementSlug: string;
  replacementName: string;
  reasonCodes: string[];
  avoidedMuscleGroups: TargetMuscleGroup[];
  targetMuscles: TargetMuscleGroup[];
  equipment: ExerciseEquipment[];
  prescription: {
    sets: number | null;
    reps: string | null;
    durationSeconds: number | null;
    restSeconds: number | null;
  };
  replacementExercise: PlanExercise;
}

export interface TrainingReplacementProposalResult {
  status: TrainingReplacementProposalStatus;
  painAreas: WorkoutPainArea[];
  avoidedMuscleGroups: TargetMuscleGroup[];
  proposals: TrainingReplacementProposal[];
  unresolvedConflicts: Array<{
    planExerciseKey: string;
    reasonCodes: string[];
  }>;
}

@Injectable()
export class PainAwareExerciseReplacementService {
  buildProposals(input: {
    dailyPlanId: string;
    exercises: PlanExercise[];
    conflictingExerciseKeys: string[];
    painAreas: WorkoutPainArea[];
    avoidedMuscleGroups: TargetMuscleGroup[];
    selection: ExerciseSelectionResult;
  }): TrainingReplacementProposalResult {
    const conflictingKeys = new Set(input.conflictingExerciseKeys);
    const avoided = new Set(input.avoidedMuscleGroups);
    const exerciseEntries = input.exercises.map((exercise, index) => ({
      exercise,
      index,
      planExerciseKey: getPlanExerciseKey(input.dailyPlanId, exercise, index)
    }));
    const existingIds = new Set(
      exerciseEntries
        .filter((entry) => !conflictingKeys.has(entry.planExerciseKey))
        .map((entry) => entry.exercise.exerciseId)
        .filter((value): value is string => Boolean(value))
    );
    const usedReplacementIds = new Set<string>();
    const proposals: TrainingReplacementProposal[] = [];
    const unresolvedConflicts: TrainingReplacementProposalResult['unresolvedConflicts'] = [];

    for (const entry of exerciseEntries.filter((item) => conflictingKeys.has(item.planExerciseKey))) {
      const originalMuscles = getExerciseMuscles(entry.exercise);
      if (!originalMuscles.some((muscle) => avoided.has(muscle))) {
        unresolvedConflicts.push({
          planExerciseKey: entry.planExerciseKey,
          reasonCodes: ['EXERCISE_KEY_NOT_CONFLICTING']
        });
        continue;
      }

      const replacement = this.findReplacement({
        original: entry.exercise,
        candidates: input.selection.candidates,
        avoided,
        existingIds,
        usedReplacementIds
      });

      if (!replacement) {
        unresolvedConflicts.push({
          planExerciseKey: entry.planExerciseKey,
          reasonCodes: ['NO_SAFE_REPLACEMENT_FOUND']
        });
        continue;
      }

      usedReplacementIds.add(replacement.exerciseId);
      const replacementExercise = this.toPlanExercise(replacement, entry.exercise, input.selection);
      proposals.push({
        originalPlanExerciseKey: entry.planExerciseKey,
        originalExerciseId: entry.exercise.exerciseId ?? null,
        originalSlug: entry.exercise.slug ?? null,
        originalName: entry.exercise.name,
        replacementExerciseId: replacement.exerciseId,
        replacementSlug: replacement.slug,
        replacementName: replacement.name,
        reasonCodes: ['AVOIDS_MARKED_AREA', 'EQUIPMENT_MATCH', 'LEVEL_MATCH'],
        avoidedMuscleGroups: input.avoidedMuscleGroups,
        targetMuscles: replacement.targetMuscles,
        equipment: replacement.equipment,
        prescription: {
          sets: parseFirstPositiveInteger(replacementExercise.sets),
          reps: replacementExercise.reps ?? null,
          durationSeconds: parseDurationSeconds(replacementExercise.duration),
          restSeconds: parseDurationSeconds(replacementExercise.rest)
        },
        replacementExercise
      });
    }

    const status: TrainingReplacementProposalStatus =
      proposals.length === 0
        ? 'NO_SAFE_REPLACEMENTS'
        : unresolvedConflicts.length > 0
          ? 'PARTIAL_REPLACEMENTS_AVAILABLE'
          : 'REPLACEMENTS_AVAILABLE';

    return {
      status,
      painAreas: input.painAreas,
      avoidedMuscleGroups: input.avoidedMuscleGroups,
      proposals,
      unresolvedConflicts
    };
  }

  applyProposals(input: {
    dailyPlanId: string;
    planJson: DailyPlanJson;
    proposalResult: TrainingReplacementProposalResult;
    acceptedOriginalPlanExerciseKeys: string[];
  }): DailyPlanJson {
    const accepted = new Set(input.acceptedOriginalPlanExerciseKeys);
    const proposalByKey = new Map(
      input.proposalResult.proposals
        .filter((proposal) => accepted.has(proposal.originalPlanExerciseKey))
        .map((proposal) => [proposal.originalPlanExerciseKey, proposal])
    );
    const exercises = input.planJson.training.exercises ?? [];
    const nextExercises = exercises.map((exercise, index) => {
      const key = getPlanExerciseKey(input.dailyPlanId, exercise, index);
      return proposalByKey.get(key)?.replacementExercise ?? exercise;
    });
    const replacedExercises = [...proposalByKey.values()].map((proposal) => ({
      originalPlanExerciseKey: proposal.originalPlanExerciseKey,
      originalExerciseName: proposal.originalName,
      replacementExerciseId: proposal.replacementExerciseId,
      replacementSlug: proposal.replacementSlug,
      replacementName: proposal.replacementName
    }));

    return {
      ...input.planJson,
      training: {
        ...input.planJson.training,
        exercises: nextExercises,
        recommendation: 'Use the adjusted workout for today and keep the session controlled.',
        notes: 'Adjusted from your pre-workout check. Stop if pain increases, dizziness appears, or anything feels unusual.'
      },
      trainingAdjustmentSnapshot: {
        source: 'PRE_WORKOUT_PAIN_REPLACEMENT',
        painAreas: input.proposalResult.painAreas,
        avoidedMuscleGroups: input.proposalResult.avoidedMuscleGroups,
        replacedExercises,
        unresolvedConflicts: input.proposalResult.unresolvedConflicts.map((item) => item.planExerciseKey),
        adjustedAt: new Date().toISOString(),
        reasonCodes: ['PRE_WORKOUT_PAIN_CONFLICT', 'CONFLICTING_EXERCISES_REPLACED']
      }
    };
  }

  private findReplacement(input: {
    original: PlanExercise;
    candidates: ExerciseCandidate[];
    avoided: Set<TargetMuscleGroup>;
    existingIds: Set<string>;
    usedReplacementIds: Set<string>;
  }) {
    const originalMuscles = new Set(getExerciseMuscles(input.original));
    const originalCategory = input.original.exerciseSnapshot?.category;
    const originalPattern = input.original.exerciseSnapshot?.movementPattern;

    return input.candidates
      .filter((candidate) => !input.existingIds.has(candidate.exerciseId))
      .filter((candidate) => !input.usedReplacementIds.has(candidate.exerciseId))
      .filter((candidate) => candidate.exerciseId !== input.original.exerciseId)
      .filter((candidate) => !candidate.targetMuscles.some((muscle) => input.avoided.has(muscle)))
      .filter((candidate) => !candidate.secondaryMuscles.some((muscle) => input.avoided.has(muscle)))
      .map((candidate) => {
        const nonPainOverlap =
          candidate.targetMuscles.filter((muscle) => originalMuscles.has(muscle) && !input.avoided.has(muscle)).length;
        const categoryMatch = originalCategory && candidate.category === originalCategory ? 1 : 0;
        const patternMatch = originalPattern && candidate.movementPattern === originalPattern ? 1 : 0;
        const recoveryBonus = new Set<ExerciseCategory>([
          ExerciseCategory.MOBILITY,
          ExerciseCategory.RECOVERY
        ]).has(candidate.category) ? 1 : 0;
        return {
          candidate,
          score:
            candidate.internalScore +
            nonPainOverlap * 150 +
            categoryMatch * 40 +
            patternMatch * 25 +
            recoveryBonus * 20 +
            (candidate.hasMedia ? 10 : 0)
        };
      })
      .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))[0]?.candidate;
  }

  private toPlanExercise(
    candidate: ExerciseCandidate,
    original: PlanExercise,
    selection: ExerciseSelectionResult
  ): PlanExercise {
    const suggestedSets = parseFirstPositiveInteger(original.sets)
      ?? selection.volumePlan.suggestedSetsPerExercise
      ?? 2;
    const suggestedRestSeconds = parseDurationSeconds(original.rest)
      ?? selection.volumePlan.suggestedRestSeconds
      ?? 60;
    const sets = candidate.category === ExerciseCategory.STRENGTH
      ? String(Math.max(1, Math.min(5, suggestedSets)))
      : undefined;
    const reps = candidate.category === ExerciseCategory.STRENGTH
      ? normalizeReps(original.reps) ?? '8-10'
      : undefined;
    const rest = candidate.category === ExerciseCategory.STRENGTH
      ? `${Math.max(15, Math.min(300, suggestedRestSeconds))} seconds`
      : undefined;
    const duration = candidate.category === ExerciseCategory.STRENGTH
      ? undefined
      : original.duration ?? `${Math.max(1, Math.min(8, Math.floor(selection.workoutDurationMinutes / 6) || 3))} minutes`;

    return {
      exerciseId: candidate.exerciseId,
      slug: candidate.slug,
      name: candidate.name,
      targetMuscles: candidate.targetMuscles,
      equipment: candidate.equipment,
      ...(sets ? { sets } : {}),
      ...(reps ? { reps } : {}),
      ...(rest ? { rest } : {}),
      ...(duration ? { duration } : {}),
      intensityCue: 'Move with steady control and keep effort comfortable today.',
      safetyNotes: candidate.safetyNotes.join(' ').slice(0, 220),
      notes: 'Selected as a safer option for today because it avoids the area you marked.',
      exerciseSnapshot: {
        resolvedLocale: candidate.resolvedLocale,
        category: candidate.category,
        movementPattern: candidate.movementPattern,
        equipment: candidate.equipment,
        targetMuscles: candidate.targetMuscles,
        secondaryMuscles: candidate.secondaryMuscles,
        instructions: candidate.instructions,
        coachingCues: candidate.coachingCues,
        safetyNotes: candidate.safetyNotes,
        exerciseUpdatedAt: candidate.exerciseUpdatedAt
      }
    };
  }
}

export function getPlanExerciseKey(dailyPlanId: string, exercise: PlanExercise, index: number) {
  const stableIdentity = exercise.exerciseId ?? exercise.slug ?? exercise.name;
  return `${dailyPlanId}:${index}:${slugify(stableIdentity)}`;
}

export function getExerciseMuscles(exercise: PlanExercise) {
  const values = [
    ...(exercise.exerciseSnapshot?.targetMuscles ?? []),
    ...(exercise.exerciseSnapshot?.secondaryMuscles ?? []),
    ...(exercise.targetMuscles ?? [])
  ];

  return [...new Set(values
    .map((value) => String(value).trim().toUpperCase())
    .filter((value): value is TargetMuscleGroup =>
      Object.values(TargetMuscleGroup).includes(value as TargetMuscleGroup)
    ))];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function parseFirstPositiveInteger(value?: string) {
  if (!value) return null;
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDurationSeconds(value?: string) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,3})(?:-(\d{1,3}))?\s+(seconds?|minutes?)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return /minute/i.test(match[3]) ? amount * 60 : amount;
}

function normalizeReps(value?: string) {
  if (!value) return null;
  return /^\d{1,2}(?:-\d{1,2})?(?: per side)?$/i.test(value.trim()) ? value.trim() : null;
}
