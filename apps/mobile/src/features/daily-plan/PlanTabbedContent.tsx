import { useQuery } from '@tanstack/react-query';
import type {
  DailyPlanCheckInResponse,
  DailyPlanJson,
  ExerciseListItem,
  MealCheckInStatus,
  SupportedLocale,
  TrainingCheckInStatus
} from '@optime/shared-types';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getExerciseSummaries } from '@/api/exercises';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { ExerciseCard } from './ExerciseCard';
import { PlanContentTabs, type PlanContentTab } from './PlanContentTabs';

interface PlanTabbedContentProps {
  planId: string;
  plan: DailyPlanJson;
  checkIns?: DailyPlanCheckInResponse[];
  checkInPending: boolean;
  locale: SupportedLocale;
  t: TFunction;
  onMealCheckIn: (mealIndex: number, mealName: string, status: MealCheckInStatus) => void;
  onTrainingCheckIn: (status: TrainingCheckInStatus, painOrDiscomfort?: boolean) => void;
}

export function PlanTabbedContent(props: PlanTabbedContentProps) {
  const { plan, planId, locale, t } = props;
  const router = useRouter();
  const exercises = Array.isArray(plan.training.exercises) ? plan.training.exercises : [];
  const exerciseIds = useMemo(() => [...new Set(exercises.flatMap((item) => item.exerciseId ? [item.exerciseId] : []))], [exercises]);
  const summaries = useQuery({
    queryKey: ['exercise-summaries', locale, exerciseIds],
    queryFn: () => getExerciseSummaries(exerciseIds),
    enabled: exerciseIds.length > 0,
    staleTime: 5 * 60 * 1000
  });
  const summaryById = new Map((summaries.data?.items ?? []).map((item) => [item.id, item] as const));
  const defaultTab: PlanContentTab = plan.nutrition.meals.length > 0 ? 'food' : exercises.length > 0 ? 'training' : 'food';
  const [selectedTab, setSelectedTab] = useState<PlanContentTab>(defaultTab);

  useEffect(() => {
    setSelectedTab(defaultTab);
  }, [defaultTab, plan.generatedAt]);

  return (
    <>
      <PlanContentTabs
        value={selectedTab}
        foodLabel={t('plan.foodTab')}
        trainingLabel={t('plan.trainingTab')}
        onChange={setSelectedTab}
      />

      {selectedTab === 'food' ? <FoodContent {...props} /> : (
        <TrainingContent
          {...props}
          exercises={exercises}
          summaryById={summaryById}
          summariesFailed={summaries.isError}
          onRetrySummaries={() => summaries.refetch()}
          onOpenExercise={(exerciseId) => router.push({
            pathname: '/exercise-details' as never,
            params: { planId, exerciseId }
          })}
        />
      )}
    </>
  );
}

function FoodContent(props: PlanTabbedContentProps) {
  const { plan, checkIns, checkInPending, t, onMealCheckIn } = props;
  return (
    <>
      <Card>
        <Text variant="label">{t('plan.meals')}</Text>
        <Text variant="muted">{t('plan.mealsHelp')}</Text>
        {plan.nutrition.meals.map((meal, index) => (
          <View key={`${meal.name}-${index}`} style={styles.block}>
            <Text variant="body">{meal.name}: {meal.foods.map((food) => `${food.portion} ${food.name}`).join(', ')}</Text>
            <View style={styles.tagRow}>
              {mealStatuses(t).map((status) => (
                <Button
                  key={status.value}
                  title={status.label}
                  variant={getMealStatus(checkIns, index) === status.value ? 'primary' : 'secondary'}
                  style={styles.checkInButton}
                  disabled={checkInPending}
                  onPress={() => onMealCheckIn(index, meal.name, status.value)}
                />
              ))}
            </View>
          </View>
        ))}
      </Card>
      <Card>
        <Text variant="label">{t('plan.hydration')}</Text>
        <Text variant="body">{plan.nutrition.hydration.guidance}</Text>
        {plan.nutrition.hydration.notes ? <Text variant="muted">{plan.nutrition.hydration.notes}</Text> : null}
      </Card>
    </>
  );
}

function TrainingContent(props: PlanTabbedContentProps & {
  exercises: DailyPlanJson['training']['exercises'];
  summaryById: Map<string, ExerciseListItem>;
  summariesFailed: boolean;
  onRetrySummaries: () => void;
  onOpenExercise: (exerciseId: string) => void;
}) {
  const { plan, exercises = [], checkIns, checkInPending, locale, t, summaryById } = props;
  return (
    <>
      <Card>
        <Text variant="label">{t('plan.trainingRecommendation')}</Text>
        <Text variant="body">{plan.training.recommendation}</Text>
        <Text variant="muted">{plan.training.notes}</Text>
      </Card>
      <Card>
        <Text variant="label">{t('plan.trainingCheckIn')}</Text>
        <Text variant="muted">{t('plan.trainingHelp')}</Text>
        <View style={styles.tagRow}>
          {trainingStatuses(t).map((status) => (
            <Button
              key={status.value}
              title={status.label}
              variant={getTrainingStatus(checkIns) === status.value ? 'primary' : 'secondary'}
              style={styles.checkInButton}
              disabled={checkInPending}
              onPress={() => props.onTrainingCheckIn(status.value)}
            />
          ))}
        </View>
        <Button
          title={t('plan.pain')}
          variant={getPainSignal(checkIns) ? 'danger' : 'secondary'}
          disabled={checkInPending}
          onPress={() => props.onTrainingCheckIn(getTrainingStatus(checkIns) ?? 'RESTED_INSTEAD', true)}
        />
        <Text variant="muted">{t('plan.painHelp')}</Text>
      </Card>
      {exercises.length ? (
        <Card>
          <Text variant="label">{t('plan.exercises')}</Text>
          {props.summariesFailed ? (
            <View style={styles.mediaError}>
              <Text variant="muted">{t('plan.mediaUnavailableCards')}</Text>
              <Button title={t('common.retry')} variant="secondary" onPress={props.onRetrySummaries} />
            </View>
          ) : null}
          {exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.exerciseId ?? `${exercise.name}-${index}`}
              exercise={exercise}
              summary={exercise.exerciseId ? summaryById.get(exercise.exerciseId) : undefined}
              locale={locale}
              t={t}
              onPress={exercise.exerciseId && exercise.exerciseSnapshot
                ? () => props.onOpenExercise(exercise.exerciseId!)
                : undefined}
            />
          ))}
          {exercises.some((exercise) => !exercise.exerciseId) ? <Text variant="muted">{t('plan.limitedDetails')}</Text> : null}
        </Card>
      ) : <Card><Text variant="muted">{t('plan.noExercises')}</Text></Card>}
    </>
  );
}

const mealStatuses = (t: TFunction): Array<{ label: string; value: MealCheckInStatus }> => [
  { label: t('plan.statusCompleted'), value: 'COMPLETED' },
  { label: t('plan.statusPartial'), value: 'PARTIALLY_COMPLETED' },
  { label: t('plan.statusSkipped'), value: 'SKIPPED' },
  { label: t('plan.statusSwapped'), value: 'SWAPPED' }
];
const trainingStatuses = (t: TFunction): Array<{ label: string; value: TrainingCheckInStatus }> => [
  { label: t('plan.statusCompleted'), value: 'COMPLETED' },
  { label: t('plan.statusPartial'), value: 'PARTIALLY_COMPLETED' },
  { label: t('plan.statusSkipped'), value: 'SKIPPED' },
  { label: t('plan.statusRested'), value: 'RESTED_INSTEAD' }
];
const getMealStatus = (items: DailyPlanCheckInResponse[] | undefined, index: number) => {
  const payload = items?.find((item) => item.type === 'MEAL' && item.subjectKey === `meal:${index}`)?.payload;
  return payload && 'status' in payload ? payload.status as MealCheckInStatus : null;
};
const getTrainingStatus = (items?: DailyPlanCheckInResponse[]) => {
  const payload = items?.find((item) => item.type === 'TRAINING')?.payload;
  return payload && 'status' in payload ? payload.status as TrainingCheckInStatus : null;
};
const getPainSignal = (items?: DailyPlanCheckInResponse[]) => {
  const payload = items?.find((item) => item.type === 'TRAINING')?.payload;
  return Boolean(payload && 'painOrDiscomfort' in payload && payload.painOrDiscomfort);
};

const styles = StyleSheet.create({
  block: { gap: 8, paddingTop: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkInButton: { minHeight: 40, paddingHorizontal: 10 },
  mediaError: { gap: 8 }
});
