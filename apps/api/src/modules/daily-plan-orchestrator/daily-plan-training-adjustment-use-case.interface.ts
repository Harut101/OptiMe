export interface PreWorkoutPainCheckInput {
  readinessStatus: string;
  painAreas?: string[];
  note?: string | null;
}

export interface AdjustDailyPlanTrainingInput {
  userId: string;
  dailyPlanId: string;
  preWorkoutCheck: PreWorkoutPainCheckInput;
}

export interface GetTrainingReplacementProposalsInput
  extends AdjustDailyPlanTrainingInput {
  conflictingExerciseKeys: string[];
}

export interface ApplyTrainingReplacementsInput
  extends GetTrainingReplacementProposalsInput {
  acceptedOriginalPlanExerciseKeys: string[];
}
