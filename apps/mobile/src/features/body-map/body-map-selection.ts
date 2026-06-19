import type { TargetMuscleGroup } from '@optime/shared-types';

export type LegacyBroadMuscleGroup = 'ARMS' | 'BACK' | 'CORE' | 'LEGS' | 'FULL_BODY';
export type SpecificMuscleGroup = Exclude<TargetMuscleGroup, LegacyBroadMuscleGroup>;

const ALL_SPECIFIC_GROUPS: SpecificMuscleGroup[] = [
  'CHEST', 'TRAPS', 'LATS', 'LOWER_BACK', 'ABS', 'OBLIQUES', 'BICEPS', 'TRICEPS',
  'FOREARMS', 'QUADRICEPS', 'HAMSTRINGS', 'ADDUCTORS', 'ABDUCTORS', 'CALVES',
  'GLUTES', 'SHOULDERS'
];

const LEGACY_GROUP_EXPANSION: Record<LegacyBroadMuscleGroup, SpecificMuscleGroup[]> = {
  ARMS: ['BICEPS', 'TRICEPS', 'FOREARMS'],
  BACK: ['TRAPS', 'LATS', 'LOWER_BACK'],
  CORE: ['ABS', 'OBLIQUES'],
  LEGS: ['GLUTES', 'QUADRICEPS', 'HAMSTRINGS', 'ADDUCTORS', 'ABDUCTORS', 'CALVES'],
  FULL_BODY: ALL_SPECIFIC_GROUPS
};

export function normalizeLegacyMuscleGroups(value: TargetMuscleGroup[]) {
  const normalized = value.flatMap((group) =>
    group in LEGACY_GROUP_EXPANSION
      ? LEGACY_GROUP_EXPANSION[group as LegacyBroadMuscleGroup]
      : [group as SpecificMuscleGroup]
  );
  return [...new Set(normalized)];
}

export function toggleSpecificMuscleGroup(
  selected: SpecificMuscleGroup[],
  group: SpecificMuscleGroup
) {
  return selected.includes(group)
    ? selected.filter((item) => item !== group)
    : [...selected, group];
}
