import { getPersistedItem, setPersistedItem } from '@/store/persistent-storage';

const HEALTH_READINESS_DISMISSED_AT_KEY = 'optime.healthReadinessPromptDismissedAt';

export const HEALTH_READINESS_DISMISSAL_WINDOW_MS = 1000 * 60 * 60 * 24;

export async function getHealthReadinessPromptDismissedAt() {
  const value = await getPersistedItem(HEALTH_READINESS_DISMISSED_AT_KEY);
  return value || null;
}

export async function dismissHealthReadinessPrompt(now = new Date()) {
  await setPersistedItem(HEALTH_READINESS_DISMISSED_AT_KEY, now.toISOString());
}

export function isHealthReadinessPromptDismissedRecently(
  dismissedAt: string | null,
  now = new Date()
) {
  if (!dismissedAt) {
    return false;
  }

  const dismissedDate = new Date(dismissedAt);
  if (Number.isNaN(dismissedDate.getTime())) {
    return false;
  }

  return now.getTime() - dismissedDate.getTime() < HEALTH_READINESS_DISMISSAL_WINDOW_MS;
}
