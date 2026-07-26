import {
  Prisma,
  ProgressiveProfilePromptKey,
  ProgressiveProfilePromptStatus
} from '@prisma/client';

export const dailyPlanPlanningUserSelect =
  Prisma.validator<Prisma.UserSelect>()({
    id: true,
    firstName: true,
    timezone: true,
    locale: true,
    isMinor: true,
    safeMode: true,
    noTrainingPlanned: true,
    privacyConsentedAt: true,
    settings: { select: { preferredLocale: true } },
    profile: {
      select: {
        gender: true,
        pregnancyStatus: true,
        dateOfBirth: true,
        heightCm: true,
        weightKg: true,
        activityLevel: true
      }
    },
    goal: {
      select: {
        goalType: true,
        primaryGoal: true,
        targetWeightKg: true,
        targetTimelineDays: true,
        impactMode: true
      }
    },
    nutritionPref: {
      select: {
        dietType: true,
        mealsPerDay: true,
        notes: true,
        noKnownAllergiesConfirmed: true,
        allergies: { select: { name: true } },
        excludedFoods: { select: { name: true } },
        dislikedFoods: { select: { name: true } },
        preferredFoods: { select: { name: true } }
      }
    },
    schedules: {
      select: {
        dayOfWeek: true,
        localTime: true,
        sportType: true,
        durationMinutes: true,
        intensity: true,
        description: true
      },
      orderBy: [{ dayOfWeek: 'asc' }, { localTime: 'asc' }]
    },
    weeklyTrainingSchedule: {
      select: { isActive: true }
    },
    trainingPreference: {
      select: {
        targetMuscleGroups: true,
        trainingOutcome: true,
        equipment: true,
        trainingLevel: true,
        limitationsOrPainAreas: true,
        preferredTrainingDays: true
      }
    },
    progressiveProfilePrompts: {
      where: {
        promptKey: {
          in: [
            ProgressiveProfilePromptKey.COOKING_TIME,
            ProgressiveProfilePromptKey.MEAL_TIMING
          ]
        },
        status: ProgressiveProfilePromptStatus.ANSWERED
      },
      select: {
        promptKey: true,
        answerJson: true
      }
    }
  });

export type DailyPlanPlanningUser = Prisma.UserGetPayload<{
  select: typeof dailyPlanPlanningUserSelect;
}>;
