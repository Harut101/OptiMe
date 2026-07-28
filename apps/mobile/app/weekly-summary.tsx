import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getEveningReflectionTrend, getPlanHistory } from '@/api/daily-plans';
import { getWorkoutHistory } from '@/api/workout-sessions';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';

export default function WeeklySummaryScreen() {
  const { t } = useTranslation();
  const plans = useQuery({ queryKey: ['weekly-summary', 'plans'], queryFn: () => getPlanHistory(7) });
  const workouts = useQuery({ queryKey: ['weekly-summary', 'workouts'], queryFn: () => getWorkoutHistory(20) });
  const reflections = useQuery({ queryKey: ['weekly-summary', 'reflections'], queryFn: getEveningReflectionTrend });

  const isLoading = plans.isLoading || workouts.isLoading || reflections.isLoading;
  const isError = plans.isError || workouts.isError || reflections.isError;

  if (isLoading) {
    return <ScreenSkeleton variant="list" cardCount={3} topSafeArea={false} />;
  }

  if (isError) {
    return (
      <Screen topSafeArea={false}>
        <StateBlock
          title={t('weeklySummary.unavailable')}
          message={t('errors.unableLoad')}
          actionTitle={t('common.retry')}
          actionLoading={plans.isRefetching || workouts.isRefetching || reflections.isRefetching}
          onAction={() => {
            void plans.refetch();
            void workouts.refetch();
            void reflections.refetch();
          }}
        />
      </Screen>
    );
  }

  const weekStart = getWeekStartLocalDate();
  const weeklyPlans = (plans.data?.items ?? []).filter((plan) => plan.planLocalDate >= weekStart);
  const completedWorkouts = (workouts.data?.items ?? []).filter(
    (workout) => workout.completedAt !== null && workout.localDate >= weekStart
  );
  const weeklyReflections = (reflections.data?.items ?? []).filter((item) => item.planLocalDate >= weekStart);
  const energy = average(weeklyReflections.map((item) => item.energyLevel));
  const tiredness = average(weeklyReflections.map((item) => item.tirednessLevel));
  const soreness = average(weeklyReflections.map((item) => item.sorenessLevel));
  const hasData = weeklyPlans.length > 0 || completedWorkouts.length > 0 || weeklyReflections.length > 0;

  return (
    <Screen
      refreshing={plans.isRefetching || workouts.isRefetching || reflections.isRefetching}
      onRefresh={() => {
        void plans.refetch();
        void workouts.refetch();
        void reflections.refetch();
      }}
      topSafeArea={false}
    >
      <Text variant="muted">{t('weeklySummary.subtitle')}</Text>

      {!hasData ? (
        <StateBlock title={t('weeklySummary.noDataTitle')} message={t('weeklySummary.noDataMessage')} />
      ) : (
        <>
          <View style={styles.metricsRow}>
            <SummaryMetric label={t('weeklySummary.plans')} value={weeklyPlans.length} />
            <SummaryMetric label={t('weeklySummary.workouts')} value={completedWorkouts.length} />
            <SummaryMetric label={t('weeklySummary.reflections')} value={weeklyReflections.length} />
          </View>

          <Card>
            <Text variant="bodyStrong">{t('eveningReflection.recent')}</Text>
            {weeklyReflections.length === 0 ? (
              <Text variant="muted">{t('weeklySummary.reflectionPrompt')}</Text>
            ) : (
              <View style={styles.reflectionMetrics}>
                <ReflectionMetric label={t('weeklySummary.averageEnergy')} value={energy} />
                <ReflectionMetric label={t('weeklySummary.averageTiredness')} value={tiredness} />
                <ReflectionMetric label={t('weeklySummary.averageSoreness')} value={soreness} />
              </View>
            )}
          </Card>

          <Card variant="muted">
            <Text variant="bodyStrong">
              {t(
                tiredness !== null && tiredness >= 7
                  ? 'weeklySummary.recoveryTakeaway'
                  : weeklyReflections.length === 0
                    ? 'weeklySummary.noReflectionTakeaway'
                    : 'weeklySummary.steadyTakeaway'
              )}
            </Text>
          </Card>
        </>
      )}
    </Screen>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.metricCard}>
      <Text variant="metric">{value}</Text>
      <Text variant="label">{label}</Text>
    </Card>
  );
}

function ReflectionMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.reflectionMetric}>
      <Text variant="label">{label}</Text>
      <Text variant="bodyStrong">{value === null ? '-' : `${value}/10`}</Text>
    </View>
  );
}

function average(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => typeof value === 'number');
  if (available.length === 0) return null;
  return Math.round((available.reduce((total, value) => total + value, 0) / available.length) * 10) / 10;
}

function getWeekStartLocalDate() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return [start.getFullYear(), String(start.getMonth() + 1).padStart(2, '0'), String(start.getDate()).padStart(2, '0')].join('-');
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: 'row',
    gap: 10
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 4
  },
  reflectionMetrics: {
    gap: 12
  },
  reflectionMetric: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16
  }
});
