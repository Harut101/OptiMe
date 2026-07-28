import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@optime/shared-types';

import { getTodayPlan } from '@/api/daily-plans';
import { getGoal } from '@/api/goals';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { DailyTrainingPlanContent } from '@/features/daily-plan/PlanTabbedContent';

/** The daily workspace. Weekly configuration lives under Profile. */
export default function TrainingScreen() {
  const { t, i18n } = useTranslation();
  const today = useQuery({ queryKey: ['today-plan'], queryFn: getTodayPlan });
  const goal = useQuery({ queryKey: ['goal'], queryFn: getGoal });

  if (today.isLoading || goal.isLoading) {
    return <ScreenSkeleton variant="detail" cardCount={4} />;
  }

  if (today.isError || goal.isError) {
    return (
      <Screen>
        <StateBlock
          title={t('training.unavailable')}
          message={t('errors.unableLoad')}
          actionTitle={t('common.retry')}
          actionLoading={today.isRefetching || goal.isRefetching}
          onAction={() => {
            void today.refetch();
            void goal.refetch();
          }}
        />
      </Screen>
    );
  }

  const appMode = goal.data?.appMode ?? goal.data?.impactMode ?? 'NUTRITION_AND_TRAINING';
  if (appMode === 'NUTRITION_ONLY') {
    return (
      <Screen>
        <ScreenHeader title={t('training.title')} />
        <Card>
          <SectionHeader title={t('training.disabledTitle')} />
          <Text variant="body">{t('training.disabledMessage')}</Text>
          <Button title={t('training.enableTraining')} onPress={() => router.push('/goal-editor')} />
        </Card>
      </Screen>
    );
  }

  if (!today.data) {
    return (
      <Screen>
        <ScreenHeader title={t('training.title')} subtitle={t('training.intro')} />
        <StateBlock
          title={t('today.noPlan')}
          message={t('today.noPlanMessage')}
          actionTitle={t('tabs.today')}
          onAction={() => router.push('/(tabs)/today')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('training.title')} subtitle={t('training.intro')} />
      <DailyTrainingPlanContent
        planId={today.data.id}
        plan={today.data.plan}
        locale={resolveSupportedLocale(i18n.resolvedLanguage)}
        t={t}
      />
    </Screen>
  );
}
