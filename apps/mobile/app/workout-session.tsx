import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@optime/shared-types';

import {
  completeWorkoutSession,
  getWorkoutSession,
  submitPostWorkoutCheckIn,
  toggleWorkoutSet,
  updateWorkoutExerciseProgress
} from '@/api/workout-sessions';
import { getExerciseSummaries } from '@/api/exercises';
import { Button } from '@/components/Button';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { AppToast } from '@/components/AppToast';
import { Screen } from '@/components/Screen';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { getExerciseMediaDisplayUrl } from '@/features/daily-plan/exercise-media-url';
import {
  TrainingLoadInsightCard,
  WorkoutExerciseCardSurface,
  WorkoutProgressHeader
} from '@/features/training-dashboard/TrainingDashboardWidgets';
import {
  formatWorkoutExerciseCount,
  formatWorkoutFocus,
  formatWorkoutSetCount,
  formatWorkoutTime
} from '@/features/workout/workout-summary';
import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';
import { Field } from '@/components/Field';
import { MultiSelectChips } from '@/components/MultiSelectChips';
import { SelectChips } from '@/components/SelectChips';
import type { PostWorkoutFeeling, WorkoutExerciseProgressResponse, WorkoutPainArea, WorkoutSessionResponse } from '@/types/api';
import { WORKOUT_PAIN_AREAS } from '@optime/shared-types';

export default function WorkoutSessionScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const [toast, setToast] = useState<{ title: string; message?: string; tone?: 'success' | 'info' | 'warning' | 'danger' } | null>(null);
  const [partialFinishVisible, setPartialFinishVisible] = useState(false);
  const session = useQuery({
    queryKey: ['workout-session', sessionId],
    queryFn: () => getWorkoutSession(sessionId!),
    enabled: Boolean(sessionId)
  });
  const exerciseIds = useMemo(
    () => [...new Set((session.data?.exerciseProgress ?? []).flatMap((item) => item.exerciseId ? [item.exerciseId] : []))],
    [session.data?.exerciseProgress]
  );
  const summaries = useQuery({
    queryKey: ['exercise-summaries', locale, exerciseIds],
    queryFn: () => getExerciseSummaries(exerciseIds),
    enabled: exerciseIds.length > 0,
    staleTime: 5 * 60 * 1000
  });
  const summaryById = new Map((summaries.data?.items ?? []).map((item) => [item.id, item] as const));
  const updateSessionCache = (next: WorkoutSessionResponse) => {
    queryClient.setQueryData(['workout-session', next.id], next);
    queryClient.setQueryData(['workout-session-by-plan', next.dailyPlanId], next);
    queryClient.setQueryData(['workout-session-summary', next.id], next.summary);
  };
  const setMutation = useMutation({
    mutationFn: ({
      progressId,
      setIndex,
      completed
    }: {
      progressId: string;
      setIndex: number;
      completed: boolean;
    }) => toggleWorkoutSet(sessionId!, progressId, { setIndex, completed }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['workout-session', sessionId] });
      const previous = queryClient.getQueryData<WorkoutSessionResponse>(['workout-session', sessionId]);
      if (previous) {
        const optimistic = applyOptimisticSet(previous, variables.progressId, variables.setIndex, variables.completed);
        updateSessionCache(optimistic);
      }
      return { previous };
    },
    onSuccess: updateSessionCache,
    onError: (_error, _variables, context) => {
      if (context?.previous) updateSessionCache(context.previous);
      setToast({ title: t('workout.saveFailed'), message: t('workout.progressKept'), tone: 'warning' });
    }
  });
  const exerciseMutation = useMutation({
    mutationFn: ({
      progressId,
      isExerciseCompleted
    }: {
      progressId: string;
      isExerciseCompleted: boolean;
    }) => updateWorkoutExerciseProgress(sessionId!, progressId, { isExerciseCompleted }),
    onSuccess: updateSessionCache,
    onError: () => setToast({ title: t('workout.saveFailed'), message: t('workout.progressKept'), tone: 'warning' })
  });
  const completeMutation = useMutation({
    mutationFn: (confirmPartialCompletion: boolean) =>
      completeWorkoutSession(sessionId!, { confirmPartialCompletion }),
    onSuccess: (next) => {
      updateSessionCache(next);
      setPartialFinishVisible(false);
      setToast({ title: t('workout.workoutCompleted'), message: t('workout.fullWorkoutCompleted'), tone: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['workout-history'] });
    },
    onError: () => setToast({ title: t('workout.saveFailed'), message: t('workout.progressKept'), tone: 'warning' })
  });
  const postWorkoutMutation = useMutation({
    mutationFn: (body: { feeling: PostWorkoutFeeling; painAreas: WorkoutPainArea[]; note?: string | null }) =>
      submitPostWorkoutCheckIn(sessionId!, body),
    onSuccess: (next) => {
      updateSessionCache(next);
      setToast({ title: t('workout.feedbackSaved'), message: t('workout.postWorkoutHelp'), tone: 'success' });
    },
    onError: () => setToast({ title: t('workout.saveFailed'), message: t('workout.progressKept'), tone: 'warning' })
  });

  if (!sessionId) {
    return <Screen topSafeArea={false}><StateBlock title={t('workout.unavailable')} message={t('workout.unavailableMessage')} /></Screen>;
  }

  if (session.isLoading) {
    return <ScreenSkeleton variant="list" cardCount={5} topSafeArea={false} />;
  }

  if (session.isError || !session.data) {
    return (
      <Screen topSafeArea={false}>
        <StateBlock
          title={t('workout.unavailable')}
          message={t('errors.unableLoad')}
          actionTitle={t('common.retry')}
          onAction={() => session.refetch()}
        />
      </Screen>
    );
  }

  const data = session.data;
  const completed = data.status === 'COMPLETED';
  const isPartial = data.summary.isPartial;

  return (
    <Screen topSafeArea={false}>
      <WorkoutProgressHeader
        title={formatWorkoutFocus(data.summary, t)}
        subtitle={data.completedAt
          ? t('workout.completedAt', { time: formatWorkoutTime(data.completedAt, i18n.resolvedLanguage) })
          : t('workout.startedAt', { time: formatWorkoutTime(data.startedAt, i18n.resolvedLanguage) })}
        progressPercent={data.progressPercent}
        completedExercises={data.completedExerciseCount}
        totalExercises={data.plannedExerciseCount}
        completedSets={data.completedSetCount}
        totalSets={data.plannedSetCount}
        exercisesLabel={t('workout.exercisesLabel')}
        setsLabel={t('workout.setsLabel')}
        completedLabel={t('workout.workoutCompleted')}
        isCompleted={completed}
        isPartial={data.summary.isPartial}
      />

      {data.trainingLoadAgentSnapshot ? (
        <TrainingLoadInsightCard
          title={t('trainingLoad.workoutGuidance')}
          message={formatTrainingLoadSessionMessage(data.trainingLoadAgentSnapshot, t)}
          status={data.trainingLoadAgentSnapshot.readiness === 'RECOVERY_FOCUSED' ? t('trainingLoad.recoveryFocused') : t('trainingLoad.keepControlled')}
          bullets={data.trainingLoadAgentSnapshot.trainingGuidanceBullets}
          tone={data.trainingLoadAgentSnapshot.readiness === 'RECOVERY_FOCUSED' ? 'warning' : 'neutral'}
        />
      ) : null}

      {data.preWorkoutCheck ? (
        <ContextNoteCard
          title={t('workout.preWorkoutCheck')}
          message={formatPreWorkoutCheck(data.preWorkoutCheck, t)}
          tone={data.preWorkoutCheck.readinessStatus === 'PAIN_OR_LIMITATION' ? 'warning' : 'neutral'}
        />
      ) : null}

      {completed ? (
        <PostWorkoutCheckInCard
          session={data}
          saving={postWorkoutMutation.isPending}
          onSubmit={(body) => postWorkoutMutation.mutate(body)}
          t={t}
        />
      ) : null}

      {data.exerciseProgress.map((progress) => (
        <WorkoutExerciseCard
          key={progress.id}
          progress={progress}
          completed={completed}
          thumbnailUrl={progress.exerciseId ? summaryById.get(progress.exerciseId)?.thumbnail?.url : undefined}
          saving={setMutation.isPending || exerciseMutation.isPending}
          onToggleSet={(setIndex, nextCompleted) =>
            setMutation.mutate({ progressId: progress.id, setIndex, completed: nextCompleted })
          }
          onToggleExercise={(nextCompleted) =>
            exerciseMutation.mutate({ progressId: progress.id, isExerciseCompleted: nextCompleted })
          }
          onOpenExercise={progress.exerciseId ? () => router.push({
            pathname: '/exercise-details' as never,
            params: { planId: data.dailyPlanId, exerciseId: progress.exerciseId! }
          }) : undefined}
        />
      ))}

      {!completed ? (
        <Button
          title={completeMutation.isPending ? t('workout.saving') : t('workout.finishWorkout')}
          disabled={completeMutation.isPending}
          onPress={() => {
            if (isPartial) {
              setPartialFinishVisible(true);
              return;
            }
            completeMutation.mutate(false);
          }}
        />
      ) : null}
      {toast ? <AppToast title={toast.title} message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} /> : null}
      <AppFeedbackSheet
        visible={partialFinishVisible}
        title={t('workout.partialTitle')}
        message={t('workout.partialMessage')}
        tone="warning"
        onClose={() => setPartialFinishVisible(false)}
        actions={[
          { label: t('workout.finishEarly'), onPress: () => completeMutation.mutate(true), variant: 'primary', disabled: completeMutation.isPending },
          { label: t('common.cancel'), onPress: () => setPartialFinishVisible(false), variant: 'secondary', disabled: completeMutation.isPending }
        ]}
      />
    </Screen>
  );
}

function WorkoutExerciseCard({
  progress,
  completed,
  thumbnailUrl,
  saving,
  onToggleSet,
  onToggleExercise,
  onOpenExercise
}: {
  progress: WorkoutExerciseProgressResponse;
  completed: boolean;
  thumbnailUrl?: string;
  saving: boolean;
  onToggleSet: (setIndex: number, completed: boolean) => void;
  onToggleExercise: (completed: boolean) => void;
  onOpenExercise?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const hasSets = typeof progress.plannedSets === 'number' && progress.plannedSets > 0;
  const imageUrl = thumbnailUrl ? getExerciseMediaDisplayUrl(thumbnailUrl) : null;
  const prescription = formatPrescription(progress, {
    setsLabel: String(t('workout.setsLabel')),
    repsLabel: String(t('workout.repsLabel')),
    durationLabel: String(t('workout.durationLabel')),
    restLabel: String(t('workout.restLabel'))
  });

  return (
    <WorkoutExerciseCardSurface
      title={progress.exerciseNameSnapshot}
      subtitle={prescription}
      thumbnailUrl={imageUrl}
      completed={progress.isExerciseCompleted}
      onOpen={onOpenExercise}
    >

      {hasSets ? (
        <View style={styles.setControl}>
          <Text variant="label" style={styles.setLabel}>{t('workout.setsLabel')}</Text>
          <View style={styles.setGrid}>
            {Array.from({ length: progress.plannedSets! }, (_, index) => {
              const checked = progress.completedSetIndexes.includes(index);
              return (
                <Pressable
                  key={index}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled: completed || saving }}
                  accessibilityLabel={t('workout.setAccessibility', {
                    exercise: progress.exerciseNameSnapshot,
                    index: String(index + 1),
                    total: String(progress.plannedSets),
                    status: checked ? t('workout.complete') : t('workout.incomplete')
                  })}
                  accessibilityHint={completed ? t('workout.readOnly') : undefined}
                  disabled={completed || saving}
                  onPress={() => onToggleSet(index, !checked)}
                  style={({ pressed }) => [
                    styles.setButton,
                    checked && styles.setButtonChecked,
                    pressed && !completed && styles.pressed
                  ]}
                >
                  <Text style={checked ? styles.setTextChecked : styles.setText}>{index + 1}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <Button
          title={progress.isExerciseCompleted ? t('workout.markExerciseIncomplete') : t('workout.markExerciseComplete')}
          variant={progress.isExerciseCompleted ? 'primary' : 'secondary'}
          disabled={completed || saving}
          accessibilityLabel={progress.isExerciseCompleted ? t('workout.markExerciseIncomplete') : t('workout.markExerciseComplete')}
          onPress={() => onToggleExercise(!progress.isExerciseCompleted)}
        />
      )}

    </WorkoutExerciseCardSurface>
  );
}

function PostWorkoutCheckInCard({
  session,
  saving,
  onSubmit,
  t
}: {
  session: WorkoutSessionResponse;
  saving: boolean;
  onSubmit: (body: { feeling: PostWorkoutFeeling; painAreas: WorkoutPainArea[]; note?: string | null }) => void;
  t: TFunction;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [visible, setVisible] = useState(false);
  const [feeling, setFeeling] = useState<PostWorkoutFeeling>('GOOD');
  const [painAreas, setPainAreas] = useState<WorkoutPainArea[]>([]);
  const [note, setNote] = useState('');

  if (session.postWorkoutCheckIn) {
    return (
      <ContextNoteCard
        title={t('workout.postWorkoutFeedback')}
        message={formatPostWorkoutCheckIn(session.postWorkoutCheckIn, t)}
        tone={session.postWorkoutCheckIn.feeling === 'PAIN_DURING_WORKOUT' ? 'warning' : 'neutral'}
      />
    );
  }

  return (
    <>
      <Card style={styles.postWorkoutPrompt}>
        <Text variant="label">{t('workout.postWorkoutCheckIn')}</Text>
        <Text variant="muted">{t('workout.postWorkoutHelp')}</Text>
        <Button
          title={t('workout.saveFeedback')}
          disabled={saving}
          onPress={() => setVisible(true)}
          accessibilityLabel={t('workout.postWorkoutCheckIn')}
        />
      </Card>
      <BottomSheet
        visible={visible}
        title={t('workout.postWorkoutCheckIn')}
        subtitle={t('workout.postWorkoutHelp')}
        presentation="form"
        onClose={() => setVisible(false)}
      >
        <View style={styles.postWorkoutSheetContent}>
          <SelectChips
            label={t('workout.howWorkoutFelt')}
            value={feeling}
            onChange={(next) => {
              setFeeling(next);
              if (next !== 'PAIN_DURING_WORKOUT') setPainAreas([]);
            }}
            options={postWorkoutOptions(t)}
          />
          {feeling === 'PAIN_DURING_WORKOUT' ? (
            <MultiSelectChips
              label={t('workout.painAreas')}
              value={painAreas}
              onChange={setPainAreas}
              options={WORKOUT_PAIN_AREAS.map((area) => ({
                value: area,
                label: getPainAreaLabel(area, t)
              }))}
            />
          ) : null}
          <Field
            label={t('workout.preWorkoutNote')}
            placeholder={t('workout.postWorkoutNotePlaceholder')}
            multiline
            value={note}
            onChangeText={setNote}
          />
          <View style={styles.postWorkoutActions}>
            <Button
              title={saving ? t('workout.saving') : t('workout.saveFeedback')}
              disabled={saving || (feeling === 'PAIN_DURING_WORKOUT' && painAreas.length === 0)}
              onPress={() => onSubmit({ feeling, painAreas, note: note.trim() || null })}
            />
            <Button
              title={t('workout.skipCheckIn')}
              variant="secondary"
              disabled={saving}
              onPress={() => onSubmit({ feeling: 'SKIPPED', painAreas: [], note: null })}
            />
          </View>
        </View>
      </BottomSheet>
    </>
  );
}

function applyOptimisticSet(
  session: WorkoutSessionResponse,
  progressId: string,
  setIndex: number,
  completed: boolean
): WorkoutSessionResponse {
  const exerciseProgress = session.exerciseProgress.map((progress) => {
    if (progress.id !== progressId || !progress.plannedSets) return progress;
    const nextIndexes = completed
      ? [...new Set([...progress.completedSetIndexes, setIndex])]
      : progress.completedSetIndexes.filter((index) => index !== setIndex);
    const completedSetIndexes = nextIndexes.sort((a, b) => a - b);
    return {
      ...progress,
      completedSetIndexes,
      isExerciseCompleted: completedSetIndexes.length === progress.plannedSets
    };
  });
  const completedSetCount = exerciseProgress.reduce((sum, progress) =>
    sum + (progress.plannedSets === null
      ? progress.isExerciseCompleted ? 1 : 0
      : progress.completedSetIndexes.length), 0);
  const completedExerciseCount = exerciseProgress.filter((progress) => progress.isExerciseCompleted).length;

  return {
    ...session,
    exerciseProgress,
    completedSetCount,
    completedExerciseCount,
    progressPercent: session.plannedSetCount > 0
      ? Math.round((completedSetCount / session.plannedSetCount) * 100)
      : 0
  };
}

function formatPrescription(
  progress: WorkoutExerciseProgressResponse,
  labels: { setsLabel: string; repsLabel: string; durationLabel: string; restLabel: string }
) {
  return [
    progress.plannedSets ? `${progress.plannedSets} ${labels.setsLabel}` : null,
    progress.plannedReps ? `${labels.repsLabel}: ${progress.plannedReps}` : null,
    progress.plannedDurationSeconds ? `${labels.durationLabel}: ${formatSeconds(progress.plannedDurationSeconds)}` : null,
    progress.plannedRestSeconds ? `${labels.restLabel}: ${formatSeconds(progress.plannedRestSeconds)}` : null
  ].filter(Boolean).join(' - ');
}

function formatSeconds(seconds: number) {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} sec`;
}

function formatPreWorkoutCheck(
  check: NonNullable<WorkoutSessionResponse['preWorkoutCheck']>,
  t: TFunction
) {
  const label = getPreWorkoutReadinessLabel(check.readinessStatus, t);
  const painAreas = check.painAreas.length
    ? ` ${t('workout.painAreasSummary', { value: check.painAreas.join(', ') })}`
    : '';
  const note = check.note ? ` ${check.note}` : '';
  const safety = check.readinessStatus === 'PAIN_OR_LIMITATION'
    ? ` ${t('workout.keepWorkoutControlled')}`
    : '';

  return `${label}.${painAreas}${note}${safety}`.trim();
}

function getPreWorkoutReadinessLabel(
  status: NonNullable<WorkoutSessionResponse['preWorkoutCheck']>['readinessStatus'],
  t: TFunction
) {
  if (status === 'GOOD') return t('workout.readinessGood');
  if (status === 'TIRED') return t('workout.readinessTired');
  if (status === 'SORE') return t('workout.readinessSore');
  if (status === 'PAIN_OR_LIMITATION') return t('workout.readinessPain');
  return t('workout.readinessSkipped');
}

function postWorkoutOptions(t: TFunction): Array<{ label: string; value: PostWorkoutFeeling }> {
  return [
    { label: t('workout.postGood'), value: 'GOOD' },
    { label: t('workout.postTooEasy'), value: 'TOO_EASY' },
    { label: t('workout.postTooHard'), value: 'TOO_HARD' },
    { label: t('workout.postPain'), value: 'PAIN_DURING_WORKOUT' }
  ];
}

function formatPostWorkoutCheckIn(
  check: NonNullable<WorkoutSessionResponse['postWorkoutCheckIn']>,
  t: TFunction
) {
  const label = check.feeling === 'GOOD'
    ? t('workout.postGood')
    : check.feeling === 'TOO_EASY'
      ? t('workout.postTooEasy')
      : check.feeling === 'TOO_HARD'
        ? t('workout.postTooHard')
        : check.feeling === 'PAIN_DURING_WORKOUT'
          ? t('workout.postPain')
          : t('workout.skipCheckIn');
  const areas = check.painAreas.length
    ? ` ${t('workout.painAreasSummary', { value: check.painAreas.map((area) => getPainAreaLabel(area, t)).join(', ') })}`
    : '';
  const note = check.note ? ` ${check.note}` : '';
  return `${label}.${areas}${note}`.trim();
}

function getPainAreaLabel(area: WorkoutPainArea, t: TFunction) {
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
}

function formatTrainingLoadSessionMessage(
  snapshot: NonNullable<WorkoutSessionResponse['trainingLoadAgentSnapshot']>,
  t: TFunction
) {
  const restGuidance = snapshot.adjustments.restTime === 'INCREASE'
    ? ` ${t('trainingLoad.takeLongerRests')}`
    : '';
  return `${snapshot.userFacingSummary}${restGuidance}`;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  postWorkoutActions: { gap: 8 },
  postWorkoutPrompt: { gap: 12 },
  postWorkoutSheetContent: { gap: 14 },
  setControl: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  setLabel: { color: colors.textSecondary, textTransform: 'capitalize' },
  setGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setButton: {
    height: 34,
    width: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0
  },
  setButtonChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  setText: { color: colors.textPrimary, fontWeight: '700' },
  setTextChecked: { color: colors.textOnAccent, fontWeight: '700' },
  pressed: { opacity: 0.78 }
});
