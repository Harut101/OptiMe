import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DailyPlanCheckInResponse,
  DailyPlanJson,
  ExerciseListItem,
  MealCheckInStatus,
  PreWorkoutCheckRequest,
  PreWorkoutReadinessStatus,
  PreWorkoutPreflightResponse,
  SupportedLocale,
  TrainingCheckInStatus,
  WorkoutPainArea
} from '@optime/shared-types';
import { WORKOUT_PAIN_AREAS } from '@optime/shared-types';
import type { WorkoutSessionResponse } from '@optime/shared-types';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getExerciseSummaries } from '@/api/exercises';
import { adjustDailyPlanTrainingForPreWorkout } from '@/api/daily-plans';
import { getWorkoutSessionByPlan, preflightWorkoutSession, startWorkoutSession } from '@/api/workout-sessions';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { Field } from '@/components/Field';
import { SelectChips } from '@/components/SelectChips';
import { MultiSelectChips } from '@/components/MultiSelectChips';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { ExerciseCard } from './ExerciseCard';
import { PlanContentTabs, type PlanContentTab } from './PlanContentTabs';
import { formatWorkoutSetCount } from '@/features/workout/workout-summary';
import { colors } from '@/theme/colors';

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
  const [preWorkoutOpen, setPreWorkoutOpen] = useState(false);
  const [preWorkoutConflict, setPreWorkoutConflict] = useState<PreWorkoutPreflightResponse | null>(null);
  const [pendingPreWorkoutCheck, setPendingPreWorkoutCheck] = useState<PreWorkoutCheckRequest | null>(null);
  const startWorkout = useMutation({
    mutationFn: (preWorkoutCheck?: PreWorkoutCheckRequest) =>
      startWorkoutSession({ dailyPlanId: planId, preWorkoutCheck }),
    onSuccess: async (session) => {
      queryClient.setQueryData(['workout-session-by-plan', planId], session);
      setPreWorkoutOpen(false);
      setPreWorkoutConflict(null);
      setPendingPreWorkoutCheck(null);
      router.push({ pathname: '/workout-session' as never, params: { sessionId: session.id } });
    }
  });
  const preflight = useMutation({
    mutationFn: (preWorkoutCheck: PreWorkoutCheckRequest) =>
      preflightWorkoutSession({ dailyPlanId: planId, preWorkoutCheck }),
    onSuccess: (result, preWorkoutCheck) => {
      if (result.conflictDetected) {
        setPreWorkoutConflict(result);
        setPendingPreWorkoutCheck(preWorkoutCheck);
        return;
      }
      startWorkout.mutate(preWorkoutCheck);
    }
  });
  const adjustWorkout = useMutation({
    mutationFn: (preWorkoutCheck: PreWorkoutCheckRequest) =>
      adjustDailyPlanTrainingForPreWorkout(planId, { preWorkoutCheck }),
    onSuccess: async (updatedPlan) => {
      queryClient.setQueryData(['today-plan'], updatedPlan);
      await queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['exercise-summaries'] });
      setPreWorkoutConflict(null);
      setPendingPreWorkoutCheck(null);
      setPreWorkoutOpen(false);
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
          preWorkoutOpen={preWorkoutOpen}
          workoutStartPending={startWorkout.isPending}
          workoutStartFailed={startWorkout.isError || preflight.isError || adjustWorkout.isError}
          preWorkoutSaving={startWorkout.isPending || preflight.isPending || adjustWorkout.isPending}
          preWorkoutConflict={preWorkoutConflict}
          onStartWorkout={() => setPreWorkoutOpen(true)}
          onCancelPreWorkout={() => {
            setPreWorkoutOpen(false);
            setPreWorkoutConflict(null);
            setPendingPreWorkoutCheck(null);
          }}
          onSubmitPreWorkout={(preWorkoutCheck) => {
            if (preWorkoutCheck.readinessStatus === 'PAIN_OR_LIMITATION') {
              preflight.mutate(preWorkoutCheck);
              return;
            }
            startWorkout.mutate(preWorkoutCheck);
          }}
          onAdjustWorkout={() => {
            if (pendingPreWorkoutCheck) adjustWorkout.mutate(pendingPreWorkoutCheck);
          }}
          onRestToday={() => router.push('/training-overrides/day' as never)}
          onContinueWithCaution={() => {
            if (pendingPreWorkoutCheck) {
              startWorkout.mutate({ ...pendingPreWorkoutCheck, acknowledgedPainConflict: true });
            }
          }}
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
  workoutSession: WorkoutSessionResponse | null;
  workoutSessionUnavailable: boolean;
  workoutSessionLoading: boolean;
  preWorkoutOpen: boolean;
  workoutStartPending: boolean;
  workoutStartFailed: boolean;
  preWorkoutSaving: boolean;
  preWorkoutConflict: PreWorkoutPreflightResponse | null;
  onStartWorkout: () => void;
  onCancelPreWorkout: () => void;
  onSubmitPreWorkout: (preWorkoutCheck: PreWorkoutCheckRequest) => void;
  onAdjustWorkout: () => void;
  onRestToday: () => void;
  onContinueWithCaution: () => void;
  onOpenWorkout: (sessionId: string) => void;
  onOpenExercise: (exerciseId: string) => void;
}) {
  const { plan, exercises = [], checkIns, checkInPending, locale, t, summaryById } = props;
  return (
    <>
      <Card>
        <Text variant="label">{t('plan.trainingRecommendation')}</Text>
        {plan.trainingLoadAgentSnapshot ? (
          <View style={styles.loadBlock}>
            <Text variant="label">{t('trainingLoad.title')}</Text>
            <StatusPill
              label={getTrainingLoadReadinessLabel(plan.trainingLoadAgentSnapshot.readiness, t)}
              tone={plan.trainingLoadAgentSnapshot.readiness === 'RECOVERY_FOCUSED' ? 'warning' : 'neutral'}
            />
            <Text variant="body">{plan.trainingLoadAgentSnapshot.userFacingSummary}</Text>
            {plan.trainingLoadAgentSnapshot.trainingGuidanceBullets.map((bullet) => (
              <Text key={bullet} variant="muted">- {bullet}</Text>
            ))}
          </View>
        ) : null}
        <Text variant="body">{plan.training.recommendation}</Text>
        <Text variant="muted">{plan.training.notes}</Text>
      </Card>
      {plan.trainingLoadAgentSnapshot?.exerciseCautions.length ? (
        <Card>
          <Text variant="label">{t('trainingLoad.exerciseCaution')}</Text>
          {plan.trainingLoadAgentSnapshot.exerciseCautions.map((caution, index) => (
            <Text key={`${caution.exerciseId ?? caution.exerciseSlug ?? 'session'}-${index}`} variant="muted">
              {caution.message}
            </Text>
          ))}
        </Card>
      ) : null}
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
      {exercises.length && props.preWorkoutOpen && !props.workoutSession ? (
        <PreWorkoutCheckCard
          t={t}
          saving={props.preWorkoutSaving}
          conflict={props.preWorkoutConflict}
          onCancel={props.onCancelPreWorkout}
          onSubmit={props.onSubmitPreWorkout}
          onAdjustWorkout={props.onAdjustWorkout}
          onRestToday={props.onRestToday}
          onContinueWithCaution={props.onContinueWithCaution}
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

function PreWorkoutCheckCard({
  t,
  saving,
  conflict,
  onCancel,
  onSubmit,
  onAdjustWorkout,
  onRestToday,
  onContinueWithCaution
}: {
  t: TFunction;
  saving: boolean;
  conflict: PreWorkoutPreflightResponse | null;
  onCancel: () => void;
  onSubmit: (preWorkoutCheck: PreWorkoutCheckRequest) => void;
  onAdjustWorkout: () => void;
  onRestToday: () => void;
  onContinueWithCaution: () => void;
}) {
  const [readinessStatus, setReadinessStatus] = useState<PreWorkoutReadinessStatus>('GOOD');
  const [painAreas, setPainAreas] = useState<WorkoutPainArea[]>([]);
  const [note, setNote] = useState('');
  const isPainContext = readinessStatus === 'PAIN_OR_LIMITATION';
  const submit = (status = readinessStatus) => {
    const includePainContext = status === 'PAIN_OR_LIMITATION';
    onSubmit({
      readinessStatus: status,
      painAreas: includePainContext ? painAreas : [],
      note: status === 'SKIPPED' ? null : note.trim() || null
    });
  };

  return (
    <Card>
      <Text variant="label">{t('workout.preWorkoutCheck')}</Text>
      <Text variant="muted">{t('workout.preWorkoutHelp')}</Text>
      {conflict ? (
        <>
          <ContextNoteCard
            title={t('workout.painConflictTitle')}
            message={t('workout.painConflictMessage')}
            tone="warning"
          />
          {conflict.conflictingExercises.map((exercise) => (
            <Text key={exercise.planExerciseKey} variant="muted">- {exercise.name}</Text>
          ))}
          <View style={styles.preWorkoutActions}>
            <Button
              title={saving ? t('workout.saving') : t('workout.adjustTodaysWorkout')}
              disabled={saving}
              onPress={onAdjustWorkout}
            />
            <Button
              title={t('workout.restToday')}
              variant="secondary"
              disabled={saving}
              onPress={onRestToday}
            />
            <Button
              title={t('workout.continueWithCaution')}
              variant="secondary"
              disabled={saving}
              onPress={onContinueWithCaution}
            />
            <Button title={t('common.cancel')} variant="secondary" disabled={saving} onPress={onCancel} />
          </View>
        </>
      ) : (
        <>
          <SelectChips
            label={t('workout.feelToday')}
            value={readinessStatus}
            onChange={(next) => {
              setReadinessStatus(next);
              if (next !== 'PAIN_OR_LIMITATION') setPainAreas([]);
            }}
            options={preWorkoutOptions(t)}
          />
          {isPainContext ? (
            <>
              <MultiSelectChips
                label={t('workout.painAreas')}
                value={painAreas}
                onChange={setPainAreas}
                options={WORKOUT_PAIN_AREAS.map((area) => ({
                  value: area,
                  label: getPainAreaLabel(area, t)
                }))}
              />
              <Text variant="muted">{t('workout.keepWorkoutControlled')}</Text>
            </>
          ) : null}
          <Field
            label={t('workout.preWorkoutNote')}
            placeholder={t('workout.preWorkoutNotePlaceholder')}
            multiline
            value={note}
            onChangeText={setNote}
          />
          <View style={styles.preWorkoutActions}>
            <Button
              title={saving ? t('workout.saving') : t('workout.continueToWorkout')}
              disabled={saving || (isPainContext && painAreas.length === 0)}
              accessibilityLabel={t('workout.continueToWorkout')}
              onPress={() => submit()}
            />
            <Button
              title={t('workout.skipPreWorkoutCheck')}
              variant="secondary"
              disabled={saving}
              accessibilityLabel={t('workout.skipPreWorkoutCheck')}
              onPress={() => submit('SKIPPED')}
            />
            <Button
              title={t('common.cancel')}
              variant="secondary"
              disabled={saving}
              onPress={onCancel}
            />
          </View>
        </>
      )}
    </Card>
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
  session: WorkoutSessionResponse | null;
  loading: boolean;
  unavailable: boolean;
  startPending: boolean;
  startFailed: boolean;
  onStart: () => void;
  onOpen: (sessionId: string) => void;
}) {
  const completed = session?.status === 'COMPLETED';
  const progress = session ? formatWorkoutSetCount(session.summary, t) : null;

  return (
    <Card>
      <Text variant="label">{completed ? t('workout.workoutCompleted') : t('workout.progress')}</Text>
      {loading ? <Text variant="muted">{t('common.loading')}</Text> : null}
      {unavailable ? <Text variant="muted">{t('workout.statusUnavailable')}</Text> : null}
      {session ? <Text variant="body">{progress}</Text> : <Text variant="muted">{t('workout.readyToStart')}</Text>}
      {session?.summary.isPartial ? <Text variant="muted">{t('workout.partialWorkoutSaved')}</Text> : null}
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
const preWorkoutOptions = (t: TFunction): Array<{ label: string; value: PreWorkoutReadinessStatus }> => [
  { label: t('workout.readinessGood'), value: 'GOOD' },
  { label: t('workout.readinessTired'), value: 'TIRED' },
  { label: t('workout.readinessSore'), value: 'SORE' },
  { label: t('workout.readinessPain'), value: 'PAIN_OR_LIMITATION' }
];
const splitCsv = (value: string) =>
  value.split(',').map((item) => item.trim()).filter(Boolean);
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
const getPainAreaLabel = (area: WorkoutPainArea, t: TFunction) => {
  if (area === 'CORE_ABS') return t('workout.painAreaCoreAbs');
  if (area === 'LOWER_BACK') return t('workout.painAreaLowerBack');
  if (area === 'SHOULDERS') return t('workout.painAreaShoulders');
  if (area === 'CHEST') return t('workout.painAreaChest');
  if (area === 'UPPER_BACK_LATS') return t('workout.painAreaUpperBackLats');
  if (area === 'BICEPS') return t('workout.painAreaBiceps');
  if (area === 'TRICEPS') return t('workout.painAreaTriceps');
  if (area === 'GLUTES') return t('workout.painAreaGlutes');
  if (area === 'HAMSTRINGS') return t('workout.painAreaHamstrings');
  if (area === 'QUADRICEPS') return t('workout.painAreaQuadriceps');
  if (area === 'CALVES') return t('workout.painAreaCalves');
  if (area === 'KNEES') return t('workout.painAreaKnees');
  if (area === 'WRISTS_FOREARMS') return t('workout.painAreaWristsForearms');
  return t('workout.painAreaOther');
};
const getTrainingLoadReadinessLabel = (
  readiness: NonNullable<DailyPlanJson['trainingLoadAgentSnapshot']>['readiness'],
  t: TFunction
) => {
  if (readiness === 'NORMAL') return t('trainingLoad.normal');
  if (readiness === 'CONTROLLED') return t('trainingLoad.controlled');
  if (readiness === 'LIGHT') return t('trainingLoad.light');
  if (readiness === 'RECOVERY_FOCUSED') return t('trainingLoad.recoveryFocused');
  return t('trainingLoad.unknown');
};

const styles = StyleSheet.create({
  block: { gap: 8, paddingTop: 6 },
  loadBlock: { gap: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkInButton: { minHeight: 40, paddingHorizontal: 10 },
  preWorkoutActions: { gap: 8 },
  mediaError: { gap: 8 },
  errorText: { color: colors.danger, fontWeight: '700' }
});
