export interface HealthPlanningContext {
  available: boolean;
  daysReviewed: number;
  latestSummary?: {
    localDate: string;
    steps?: number;
    sleepMinutes?: number;
    activeEnergyKcal?: number;
    workoutCount?: number;
    workoutMinutes?: number;
  };
  recentAverages?: {
    steps?: number;
    sleepMinutes?: number;
    activeEnergyKcal?: number;
    workoutMinutes?: number;
  };
  signals: {
    lowSleep: boolean;
    highActivityYesterday: boolean;
    recentWorkout: boolean;
    lowStepTrend: boolean;
  };
  selectionNotes: string[];
}

export const EMPTY_HEALTH_PLANNING_CONTEXT: HealthPlanningContext = {
  available: false,
  daysReviewed: 0,
  signals: {
    lowSleep: false,
    highActivityYesterday: false,
    recentWorkout: false,
    lowStepTrend: false
  },
  selectionNotes: []
};

