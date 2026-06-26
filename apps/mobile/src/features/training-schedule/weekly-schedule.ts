import type {
  DayOfWeek,
  TrainingScheduleDayRequest,
  TrainingScheduleRequest,
  TrainingScheduleResponse
} from '@optime/shared-types';

export const ORDERED_DAYS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

export function toDraft(response: TrainingScheduleResponse): TrainingScheduleRequest {
  return {
    isActive: response.isActive,
    days: response.days.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      isTrainingDay: day.isTrainingDay,
      targetMusclesMode: day.targetMusclesMode,
      targetMuscles: day.targetMuscles ?? [],
      environmentMode: day.environmentMode,
      environment: day.environment ?? null,
      equipmentMode: day.equipmentMode,
      availableEquipment: day.availableEquipment ?? [],
      durationMode: day.durationMode,
      durationMinutes: day.durationMinutes ?? null,
      protocolMode: day.protocolMode ?? 'USE_DEFAULT',
      protocolPreference: day.protocolPreference ?? null
    }))
  };
}

export function createEmptyDraft(): TrainingScheduleRequest {
  return {
    isActive: true,
    days: ORDERED_DAYS.map(createDefaultDay)
  };
}

export function createSuggestedDraft(frequency: number): TrainingScheduleRequest {
  const suggested = new Set(suggestedDays(frequency));
  return {
    isActive: true,
    days: ORDERED_DAYS.map((dayOfWeek) => ({
      ...createDefaultDay(dayOfWeek),
      isTrainingDay: suggested.has(dayOfWeek)
    }))
  };
}

export function createDefaultDay(dayOfWeek: DayOfWeek): TrainingScheduleDayRequest {
  return {
    dayOfWeek,
    isTrainingDay: false,
    targetMusclesMode: 'USE_DEFAULT',
    targetMuscles: [],
    environmentMode: 'USE_DEFAULT',
    environment: null,
    equipmentMode: 'USE_DEFAULT',
    availableEquipment: [],
    durationMode: 'USE_DEFAULT',
    durationMinutes: null,
    protocolMode: 'USE_DEFAULT',
    protocolPreference: null
  };
}

function suggestedDays(frequency: number): DayOfWeek[] {
  if (frequency <= 0) return [];
  if (frequency === 1) return ['MONDAY'];
  if (frequency === 2) return ['MONDAY', 'THURSDAY'];
  if (frequency === 3) return ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
  if (frequency === 4) return ['MONDAY', 'TUESDAY', 'THURSDAY', 'SATURDAY'];
  if (frequency === 5) return ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'FRIDAY', 'SATURDAY'];
  if (frequency === 6) return ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return ORDERED_DAYS;
}
