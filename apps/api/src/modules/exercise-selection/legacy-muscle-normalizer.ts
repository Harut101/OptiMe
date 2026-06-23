import { TargetMuscleGroup } from '@prisma/client';

const LEGACY_EXPANSIONS: Partial<Record<TargetMuscleGroup, TargetMuscleGroup[]>> = {
  [TargetMuscleGroup.ARMS]: [TargetMuscleGroup.BICEPS, TargetMuscleGroup.TRICEPS, TargetMuscleGroup.FOREARMS],
  [TargetMuscleGroup.BACK]: [TargetMuscleGroup.TRAPS, TargetMuscleGroup.LATS, TargetMuscleGroup.LOWER_BACK],
  [TargetMuscleGroup.CORE]: [TargetMuscleGroup.ABS, TargetMuscleGroup.OBLIQUES],
  [TargetMuscleGroup.LEGS]: [
    TargetMuscleGroup.GLUTES,
    TargetMuscleGroup.QUADRICEPS,
    TargetMuscleGroup.HAMSTRINGS,
    TargetMuscleGroup.ADDUCTORS,
    TargetMuscleGroup.ABDUCTORS,
    TargetMuscleGroup.CALVES
  ]
};

export function normalizeLegacyTargetMuscles(values: TargetMuscleGroup[]) {
  return [...new Set(values.flatMap((value) => LEGACY_EXPANSIONS[value] ?? [value]))];
}

