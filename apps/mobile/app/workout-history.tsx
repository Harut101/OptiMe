import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { getWorkoutHistory } from '@/api/workout-sessions';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { WorkoutHistoryCard } from '@/features/training-dashboard/TrainingDashboardWidgets';
import {
  formatWorkoutDate,
  formatWorkoutExerciseCount,
  formatWorkoutFocus,
  formatWorkoutSetCount,
  formatWorkoutTime,
  getWorkoutAccessibilityLabel
} from '@/features/workout/workout-summary';
import { useSettingsStore } from '@/store/settings-store';
import type { WorkoutSessionSummary } from '@/types/api';

export default function WorkoutHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const preferredLocale = useSettingsStore((state) => state.preferredLocale);
  const history = useQuery({
    queryKey: ['workout-history'],
    queryFn: () => getWorkoutHistory(20)
  });

  if (history.isLoading) {
    return <ScreenSkeleton variant="list" cardCount={5} />;
  }

  if (history.isError) {
    return (
      <Screen>
        <StateBlock
          title={t('workout.historyUnavailable')}
          message={t('errors.unableLoad')}
          actionTitle={t('common.retry')}
          onAction={() => history.refetch()}
        />
      </Screen>
    );
  }

  const items = history.data?.items ?? [];

  return (
    <Screen refreshing={history.isRefetching} onRefresh={() => history.refetch()}>
      <ScreenHeader title={t('workout.workoutHistory')} subtitle={t('workout.historyIntro')} />

      {items.length === 0 ? (
        <StateBlock
          title={t('workout.noHistoryTitle')}
          message={t('workout.noHistoryMessage')}
        />
      ) : null}

      {items.map((item) => (
        <WorkoutHistoryItem
          key={item.id}
          item={item}
          locale={preferredLocale}
          onPress={() => router.push({ pathname: '/workout-session' as never, params: { sessionId: item.id } })}
        />
      ))}
    </Screen>
  );
}

function WorkoutHistoryItem({
  item,
  locale,
  onPress
}: {
  item: WorkoutSessionSummary;
  locale: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const completedTime = formatWorkoutTime(item.completedAt, locale);

  return (
    <WorkoutHistoryCard
      label={formatWorkoutDate(item.localDate, locale)}
      title={formatWorkoutFocus(item, t)}
      subtitle={`${formatWorkoutSetCount(item, t)} - ${formatWorkoutExerciseCount(item, t)}`}
      meta={completedTime ? t('workout.completedAt', { time: completedTime }) : undefined}
      statusLabel={item.isPartial ? t('workout.partial') : t('workout.workoutCompleted')}
      isPartial={item.isPartial}
      accessibilityLabel={getWorkoutAccessibilityLabel(item, t)}
      onPress={onPress}
    />
  );
}
