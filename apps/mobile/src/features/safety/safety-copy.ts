import type { DailyPlanResponse } from '@/types/api';
import type { TFunction } from 'i18next';

export function getPlanSafetyMessage(planResponse: DailyPlanResponse | null | undefined, t: TFunction) {
  if (!planResponse) {
    return null;
  }

  const plan = planResponse.plan;

  if (planResponse.status !== 'FALLBACK' && !plan.safety.adjustedForSafety) {
    return null;
  }

  return plan.safety.userSafeMessage ?? mapSafetyReasonsToUserMessage(plan.safety.reasons, t);
}

export function getFriendlyGoalErrorMessage(error: Error, t?: TFunction) {
  const message = error.message.toLowerCase();

  if (message.includes('steadier goal') || message.includes('weight goal')) {
    return t?.('safety.goalSteady' as never) ?? "Let's choose a steadier goal that supports energy, training, and recovery.";
  }

  if (
    message.includes('pregnancy') ||
    message.includes('postpartum') ||
    message.includes('breastfeeding')
  ) {
    return t?.('safety.goalHealthContext' as never) ?? 'For this health context, OptiMe keeps goals focused on steady energy, recovery, hydration, and balanced habits.';
  }

  if (message.includes('profile')) {
    return t?.('safety.goalProfile' as never) ?? 'Please finish your profile first so we can keep this goal safe and realistic.';
  }

  return t?.('safety.goalGeneric' as never) ?? 'Please adjust this goal and try again. We want the plan to stay safe, steady, and practical.';
}

function mapSafetyReasonsToUserMessage(reasons: string[], t: TFunction) {
  const reasonText = reasons.join(' | ').toLowerCase();

  if (
    reasonText.includes('under 18') ||
    reasonText.includes('minor') ||
    reasonText.includes('safe mode')
  ) {
    return t('safety.planAdjustedBalanced' as never);
  }

  if (
    reasonText.includes('weight loss') ||
    reasonText.includes('weight-loss') ||
    reasonText.includes('steadier goal') ||
    reasonText.includes('aggressive')
  ) {
    return t('safety.planAdjustedSteady' as never);
  }

  if (
    reasonText.includes('pregnancy') ||
    reasonText.includes('postpartum') ||
    reasonText.includes('breastfeeding') ||
    reasonText.includes('nursing')
  ) {
    return t('safety.planAdjustedHealthContext' as never);
  }

  if (reasonText.includes('allerg') || reasonText.includes('excluded food')) {
    return t('safety.planAdjustedFoodSafety' as never);
  }

  if (
    reasonText.includes('pain') ||
    reasonText.includes('dizz') ||
    reasonText.includes('illness') ||
    reasonText.includes('exhaust') ||
    reasonText.includes('injur')
  ) {
    return t('safety.planAdjustedTraining' as never);
  }

  if (reasonText.includes('safety_agent')) {
    return t('safety.planAdjustedReview' as never);
  }

  if (
    reasonText.includes('safely validated') ||
    reasonText.includes('schema_validation') ||
    reasonText.includes('json_parse') ||
    reasonText.includes('missing_output') ||
    reasonText.includes('openai_')
  ) {
    return t('safety.planAdjustedFallback' as never);
  }

  return t('safety.planAdjustedGeneric' as never);
}
