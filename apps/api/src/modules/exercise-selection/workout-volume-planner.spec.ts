import { PlanQualityMode, TrainingLevel } from '@prisma/client';

import { trainingProtocols } from '../protocol/training-protocols';
import type { ExerciseSelectionContext } from './exercise-selection.types';
import { WorkoutVolumePlanner } from './workout-volume-planner';

describe('WorkoutVolumePlanner recovery boundaries', () => {
  const planner = new WorkoutVolumePlanner();

  it('reduces exercise volume and lengthens rest for low recovery', () => {
    const normal = planner.plan(context(false));
    const lowRecovery = planner.plan(context(true));

    expect(lowRecovery.targetExerciseCount).toBeLessThan(
      normal.targetExerciseCount
    );
    expect(lowRecovery.suggestedSetsPerExercise).toBe(2);
    expect(lowRecovery.suggestedRestSeconds).toBe(90);
    expect(lowRecovery.volumeReasonCodes).toContain(
      'LOW_RECOVERY_REDUCTION'
    );
  });
});

function context(lowRecovery: boolean): ExerciseSelectionContext {
  return {
    locale: 'en-US',
    planDate: '2026-07-28',
    protocol: trainingProtocols.STRENGTH,
    availableEquipment: [],
    trainingLevel: TrainingLevel.INTERMEDIATE,
    targetMuscles: [],
    workoutDurationMinutes: 60,
    limitationsPresent: false,
    safeMode: false,
    isMinor: false,
    healthSignals: {
      lowSleep: false,
      lowRecovery,
      highActivity: false,
      lowStepTrend: false
    },
    qualityMode: PlanQualityMode.ADAPTIVE
  };
}
