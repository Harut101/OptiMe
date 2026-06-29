import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getWorkoutHistory } from '@/api/workout-sessions';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StateBlock } from '@/components/StateBlock';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import {
  formatWorkoutDate,
  formatWorkoutExerciseCount,
  formatWorkoutFocus,
  formatWorkoutSetCount,
  formatWorkoutTime,
  getWorkoutAccessibilityLabel
} from '@/features/workout/workout-summary';
import { useSettingsStore } from '@/store/settings-store';
import { colors } from '@/theme/colors';
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
    return <StateBlock title={t('workout.historyLoading')} message={t('workout.historyLoadingMessage')} />;
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={getWorkoutAccessibilityLabel(item, t)}
      onPress={onPress}
    >
      <Card>
        <View style={styles.cardHeader}>
          <View style={styles.cardText}>
            <Text variant="label">{formatWorkoutDate(item.localDate, locale)}</Text>
            <Text variant="body">{formatWorkoutFocus(item, t)}</Text>
            <Text variant="muted">
              {formatWorkoutSetCount(item, t)} - {formatWorkoutExerciseCount(item, t)}
            </Text>
            {completedTime ? (
              <Text variant="muted">{t('workout.completedAt', { time: completedTime })}</Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.muted} accessible={false} />
        </View>
        {item.isPartial ? <StatusPill label={t('workout.partial')} tone="warning" /> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  cardText: {
    flex: 1,
    gap: 4
  },
});
