import type { TFunction } from 'i18next';

import type { DailyPlanJson } from '@/types/api';

type ContextNotes = NonNullable<DailyPlanJson['contextNotes']>;
type ContextNote = NonNullable<ContextNotes[keyof ContextNotes]>;

export function getContextNoteTitle(t: TFunction, titleCode: ContextNote['titleCode']) {
  switch (titleCode) {
    case 'APPLE_HEALTH_DATA_INCLUDED':
      return t('contextNotes.appleHealthTitle');
    case 'USING_PROFILE_AND_SCHEDULE':
      return t('contextNotes.profileScheduleTitle');
    case 'TRAINING_LOAD_CONTEXT':
      return t('contextNotes.trainingLoadTitle');
    case 'RECOVERY_CONTEXT':
      return t('contextNotes.recoveryTitle');
    case 'WEARABLE_DATA_INCLUDED':
    default:
      return t('contextNotes.wearableTitle');
  }
}

export function getContextNoteMessage(t: TFunction, messageCode: ContextNote['messageCode']) {
  switch (messageCode) {
    case 'RECENT_ACTIVITY_AND_SLEEP_AVAILABLE':
      return t('contextNotes.recentActivityAndSleep');
    case 'RECENT_ACTIVITY_INCLUDED':
      return t('contextNotes.recentActivity');
    case 'RECENT_SLEEP_INCLUDED':
      return t('contextNotes.recentSleep');
    case 'NO_RECENT_WEARABLE_DATA_USED':
      return t('contextNotes.noRecentWearable');
    case 'WEARABLE_DATA_STALE':
      return t('contextNotes.wearableStale');
    case 'KEEP_WORKOUT_CONTROLLED':
      return t('contextNotes.keepWorkoutControlled');
    case 'TAKE_LONGER_RESTS':
      return t('contextNotes.takeLongerRests');
    case 'GENTLER_RECOVERY_FOCUS':
      return t('contextNotes.gentlerRecovery');
    default:
      return t('contextNotes.noRecentWearable');
  }
}
