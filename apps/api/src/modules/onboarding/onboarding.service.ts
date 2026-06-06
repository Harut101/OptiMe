import { Injectable } from '@nestjs/common';
import { GoalType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ProgressiveProfileService } from '../progressive-profile/progressive-profile.service';

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

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progressiveProfileService: ProgressiveProfileService
  ) {}

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
      progressiveProfile: await this.progressiveProfileService.getProgressiveProfileSummary(userId)
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

}
