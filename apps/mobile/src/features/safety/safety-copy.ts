import type { DailyPlanResponse } from '@/types/api';
import type { TFunction } from 'i18next';

export const WELLNESS_DISCLAIMER =
  'OptiMe is an AI wellness assistant, not a medical service. It does not diagnose or treat medical conditions. For injuries, pregnancy/postpartum concerns, medical symptoms, or major lifestyle changes, consider consulting a qualified professional.';

export function getPlanSafetyMessage(planResponse?: DailyPlanResponse | null) {
  if (!planResponse) {
    return null;
  }

  const plan = planResponse.plan;

  if (planResponse.status !== 'FALLBACK' && !plan.safety.adjustedForSafety) {
    return null;
  }

  return plan.safety.userSafeMessage ?? mapSafetyReasonsToUserMessage(plan.safety.reasons);
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

function mapSafetyReasonsToUserMessage(reasons: string[]) {
  const reasonText = reasons.join(' | ').toLowerCase();

  if (
    reasonText.includes('under 18') ||
    reasonText.includes('minor') ||
    reasonText.includes('safe mode')
  ) {
    return 'We adjusted today toward balanced meals, hydration, recovery, and healthy movement.';
  }

  if (
    reasonText.includes('weight loss') ||
    reasonText.includes('weight-loss') ||
    reasonText.includes('steadier goal') ||
    reasonText.includes('aggressive')
  ) {
    return 'We adjusted today toward a steadier plan that supports energy, training, and recovery.';
  }

  if (
    reasonText.includes('pregnancy') ||
    reasonText.includes('postpartum') ||
    reasonText.includes('breastfeeding') ||
    reasonText.includes('nursing')
  ) {
    return 'We adjusted today toward gentle, balanced guidance because your health context calls for extra care.';
  }

  if (reasonText.includes('allerg') || reasonText.includes('excluded food')) {
    return 'We switched to a safer plan because the generated plan may have conflicted with your allergies or excluded foods.';
  }

  if (
    reasonText.includes('pain') ||
    reasonText.includes('dizz') ||
    reasonText.includes('illness') ||
    reasonText.includes('exhaust') ||
    reasonText.includes('injur')
  ) {
    return 'We reduced training intensity today so movement stays conservative and recovery-friendly.';
  }

  if (reasonText.includes('safety_agent')) {
    return 'We used a safer fallback because the generated plan needed a more conservative safety review.';
  }

  if (
    reasonText.includes('safely validated') ||
    reasonText.includes('schema_validation') ||
    reasonText.includes('json_parse') ||
    reasonText.includes('missing_output') ||
    reasonText.includes('openai_')
  ) {
    return 'We used a reliable safe plan today because the generated plan could not be fully verified.';
  }

  return 'We adjusted today toward a safer, steadier plan.';
}
