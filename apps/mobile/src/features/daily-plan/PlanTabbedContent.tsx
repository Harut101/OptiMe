import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { getWorkoutSessionByPlan, startWorkoutSession } from '@/api/workout-sessions';
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
  const queryClient = useQueryClient();
  const exercises = Array.isArray(plan.training.exercises) ? plan.training.exercises : [];
  const exerciseIds = useMemo(() => [...new Set(exercises.flatMap((item) => item.exerciseId ? [item.exerciseId] : []))], [exercises]);
  const summaries = useQuery({
    queryKey: ['exercise-summaries', locale, exerciseIds],
    queryFn: () => getExerciseSummaries(exerciseIds),
    enabled: exerciseIds.length > 0,
    staleTime: 5 * 60 * 1000
  });
  const workoutSession = useQuery({
    queryKey: ['workout-session-by-plan', planId],
    queryFn: () => getWorkoutSessionByPlan(planId),
    enabled: exercises.length > 0
  });
  const startWorkout = useMutation({
    mutationFn: () => startWorkoutSession({ dailyPlanId: planId }),
    onSuccess: async (session) => {
      queryClient.setQueryData(['workout-session-by-plan', planId], session);
      router.push({ pathname: '/workout-session' as never, params: { sessionId: session.id } });
    }
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
          workoutSession={workoutSession.data ?? null}
          workoutSessionUnavailable={workoutSession.isError}
          workoutSessionLoading={workoutSession.isLoading}
          workoutStartPending={startWorkout.isPending}
          workoutStartFailed={startWorkout.isError}
          onStartWorkout={() => startWorkout.mutate()}
          onOpenWorkout={(sessionId) =>
            router.push({ pathname: '/workout-session' as never, params: { sessionId } })
          }
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
  workoutSession: import('@optime/shared-types').WorkoutSessionResponse | null;
  workoutSessionUnavailable: boolean;
  workoutSessionLoading: boolean;
  workoutStartPending: boolean;
  workoutStartFailed: boolean;
  onStartWorkout: () => void;
  onOpenWorkout: (sessionId: string) => void;
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
        <WorkoutSessionCard
          t={t}
          session={props.workoutSession}
          loading={props.workoutSessionLoading}
          unavailable={props.workoutSessionUnavailable}
          startPending={props.workoutStartPending}
          startFailed={props.workoutStartFailed}
          onStart={props.onStartWorkout}
          onOpen={props.onOpenWorkout}
        />
      ) : null}
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

function WorkoutSessionCard({
  t,
  session,
  loading,
  unavailable,
  startPending,
  startFailed,
  onStart,
  onOpen
}: {
  t: TFunction;
  session: import('@optime/shared-types').WorkoutSessionResponse | null;
  loading: boolean;
  unavailable: boolean;
  startPending: boolean;
  startFailed: boolean;
  onStart: () => void;
  onOpen: (sessionId: string) => void;
}) {
  const completed = session?.status === 'COMPLETED';
  const progress = session
    ? t('workout.setsCompleted', {
        completed: String(session.completedSetCount),
        total: String(session.plannedSetCount)
      })
    : null;

  return (
    <Card>
      <Text variant="label">{t('workout.progress')}</Text>
      {loading ? <Text variant="muted">{t('common.loading')}</Text> : null}
      {unavailable ? <Text variant="muted">{t('workout.statusUnavailable')}</Text> : null}
      {session ? <Text variant="body">{progress}</Text> : <Text variant="muted">{t('workout.readyToStart')}</Text>}
      {startFailed ? <Text style={styles.errorText}>{t('workout.saveFailed')}</Text> : null}
      {session ? (
        <Button
          title={completed ? t('workout.viewWorkout') : t('workout.continueWorkout')}
          variant={completed ? 'secondary' : 'primary'}
          accessibilityLabel={completed ? t('workout.workoutCompleted') : t('workout.continueWorkout')}
          onPress={() => onOpen(session.id)}
        />
      ) : (
        <Button
          title={startPending ? t('workout.saving') : t('workout.startWorkout')}
          disabled={startPending || loading || unavailable}
          accessibilityLabel={t('workout.startWorkout')}
          onPress={onStart}
        />
      )}
      {completed ? <Text variant="muted">{t('workout.workoutCompleted')}</Text> : null}
    </Card>
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
  mediaError: { gap: 8 },
  errorText: { color: '#b44848', fontWeight: '700' }
});
