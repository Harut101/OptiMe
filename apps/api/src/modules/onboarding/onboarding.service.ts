import { Injectable } from '@nestjs/common';
import { GoalType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

type ProgressivePrompt = {
  key: string;
  title: string;
  description: string;
  inputType: string;
  options?: Array<{ label: string; value: string }>;
};

type Stage1Input = {
  firstName?: string | null;
  noTrainingPlanned?: boolean | null;
  privacyConsentedAt?: Date | null;
  profile?: {
    gender?: string | null;
    dateOfBirth?: Date | null;
    heightCm?: number | null;
    weightKg?: number | null;
    activityLevel?: string | null;
    pregnancyStatus?: string | null;
  } | null;
  goal?: {
    goalType?: string | null;
    targetWeightKg?: number | null;
    targetTimelineDays?: number | null;
    impactMode?: string | null;
  } | null;
  nutritionPref?: {
    dietType?: string | null;
    mealsPerDay?: number | null;
    noKnownAllergiesConfirmed?: boolean | null;
    allergies?: Array<{ name: string }>;
    excludedFoods?: Array<{ name: string }>;
    preferredFoods?: Array<{ name: string }>;
  } | null;
  schedules?: unknown[];
};

const progressivePrompts: ProgressivePrompt[] = [
  {
    key: 'preferredFoods',
    title: 'Foods you enjoy',
    description: 'Add a few foods you like so future plans feel easier to follow.',
    inputType: 'stringList'
  },
  {
    key: 'excludedFoods',
    title: 'Foods you prefer to avoid',
    description: 'Add foods you do not want in regular meal suggestions.',
    inputType: 'stringList'
  },
  {
    key: 'dietType',
    title: 'Diet style',
    description: 'Share a diet style if one matters to you.',
    inputType: 'singleSelect',
    options: [
      { label: 'No specific style', value: 'NONE' },
      { label: 'Vegetarian', value: 'VEGETARIAN' },
      { label: 'Vegan', value: 'VEGAN' },
      { label: 'Mediterranean', value: 'MEDITERRANEAN' }
    ]
  },
  {
    key: 'mealsPerDay',
    title: 'Meals per day',
    description: 'Tell us how many meals usually fits your day.',
    inputType: 'number'
  },
  {
    key: 'targetMuscleGroups',
    title: 'Target body areas',
    description: 'Later, this will help personalize exercise suggestions.',
    inputType: 'multiSelect'
  },
  {
    key: 'equipment',
    title: 'Available equipment',
    description: 'Later, this will help tailor training to home, gym, or bodyweight options.',
    inputType: 'multiSelect'
  },
  {
    key: 'trainingLevel',
    title: 'Training level',
    description: 'Later, this will help set exercise complexity and progression.',
    inputType: 'singleSelect'
  },
  {
    key: 'limitationsOrPainAreas',
    title: 'Limitations or pain areas',
    description: 'Share anything we should account for to keep guidance safer.',
    inputType: 'stringList'
  },
  {
    key: 'cookingTimePreference',
    title: 'Cooking time',
    description: 'Later, this will help match meals to your available time.',
    inputType: 'singleSelect'
  },
  {
    key: 'mealPrepPreference',
    title: 'Meal prep preference',
    description: 'Later, this will help plan practical meals for your week.',
    inputType: 'singleSelect'
  },
  {
    key: 'mealTimingPreference',
    title: 'Meal timing',
    description: 'Later, this will help time food around training and daily rhythm.',
    inputType: 'singleSelect'
  }
];

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        firstName: true,
        noTrainingPlanned: true,
        privacyConsentedAt: true,
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
            targetWeightKg: true,
            targetTimelineDays: true,
            impactMode: true
          }
        },
        nutritionPref: {
          select: {
            dietType: true,
            mealsPerDay: true,
            noKnownAllergiesConfirmed: true,
            allergies: { select: { name: true } },
            excludedFoods: { select: { name: true } },
            preferredFoods: { select: { name: true } }
          }
        },
        schedules: {
          select: { id: true }
        }
      }
    });

    const stage1 = this.evaluateStage1Readiness(user);
    const profileCompleted = Boolean(user.profile);
    const goalCompleted = Boolean(user.goal);
    const nutritionPreferencesCompleted = Boolean(user.nutritionPref);
    const trainingScheduleCompleted = user.schedules.length > 0;
    const privacyConsentCompleted = Boolean(user.privacyConsentedAt);

    return {
      profileCompleted,
      goalCompleted,
      nutritionPreferencesCompleted,
      trainingScheduleCompleted,
      privacyConsentCompleted,
      canGeneratePlan: stage1.canGenerateFirstPlan,
      stage1Completed: stage1.stage1Completed,
      canGenerateFirstPlan: stage1.canGenerateFirstPlan,
      missingStage1Fields: stage1.missingStage1Fields,
      progressiveProfile: this.getProgressiveProfile(user)
    };
  }

  evaluateStage1Readiness(input: Stage1Input) {
    const missingStage1Fields: string[] = [];

    if (!input.privacyConsentedAt) {
      missingStage1Fields.push('privacyConsent');
    }

    if (!input.firstName?.trim()) {
      missingStage1Fields.push('firstName');
    }

    if (!input.profile) {
      missingStage1Fields.push(
        'gender',
        'dateOfBirth',
        'heightCm',
        'weightKg',
        'activityLevel'
      );
    } else {
      if (!input.profile.gender?.trim()) missingStage1Fields.push('gender');
      if (!input.profile.dateOfBirth) missingStage1Fields.push('dateOfBirth');
      if (!input.profile.heightCm) missingStage1Fields.push('heightCm');
      if (!input.profile.weightKg) missingStage1Fields.push('weightKg');
      if (!input.profile.activityLevel) missingStage1Fields.push('activityLevel');
    }

    if (!input.goal?.goalType) {
      missingStage1Fields.push('goalType');
    } else if (input.goal.goalType === GoalType.REDUCE_WEIGHT) {
      if (!input.goal.targetWeightKg) missingStage1Fields.push('targetWeightKg');
      if (!input.goal.targetTimelineDays) missingStage1Fields.push('targetTimelineDays');
      if (!input.goal.impactMode) missingStage1Fields.push('impactMode');
    }

    const allergyCount = input.nutritionPref?.allergies?.length ?? 0;
    const noKnownAllergiesConfirmed = Boolean(input.nutritionPref?.noKnownAllergiesConfirmed);

    if (!input.nutritionPref || (allergyCount === 0 && !noKnownAllergiesConfirmed)) {
      missingStage1Fields.push('allergyInformation');
    }

    const scheduleCount = input.schedules?.length ?? 0;

    if (scheduleCount === 0 && !input.noTrainingPlanned) {
      missingStage1Fields.push('basicTrainingIntent');
    }

    return {
      stage1Completed: missingStage1Fields.length === 0,
      canGenerateFirstPlan: missingStage1Fields.length === 0,
      missingStage1Fields
    };
  }

  private getProgressiveProfile(input: Stage1Input) {
    const completedPrompts = this.getCompletedProgressivePrompts(input);
    const nextPrompt = progressivePrompts.find((prompt) => !completedPrompts.includes(prompt.key));

    return {
      completedPrompts,
      ...(nextPrompt ? { nextPrompt } : {}),
      completionPercent: Math.round((completedPrompts.length / progressivePrompts.length) * 100)
    };
  }

  private getCompletedProgressivePrompts(input: Stage1Input) {
    const completed = new Set<string>();

    if ((input.nutritionPref?.preferredFoods?.length ?? 0) > 0) {
      completed.add('preferredFoods');
    }

    if ((input.nutritionPref?.excludedFoods?.length ?? 0) > 0) {
      completed.add('excludedFoods');
    }

    if (input.nutritionPref?.dietType && input.nutritionPref.dietType !== 'NONE') {
      completed.add('dietType');
    }

    if (input.nutritionPref?.mealsPerDay) {
      completed.add('mealsPerDay');
    }

    return [...completed];
  }
}
