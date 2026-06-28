import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@optime/shared-types';

import {
  completeWorkoutSession,
  getWorkoutSession,
  toggleWorkoutSet,
  updateWorkoutExerciseProgress
} from '@/api/workout-sessions';
import { getExerciseSummaries } from '@/api/exercises';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { getExerciseMediaDisplayUrl } from '@/features/daily-plan/exercise-media-url';
import {
  formatWorkoutDate,
  formatWorkoutExerciseCount,
  formatWorkoutFocus,
  formatWorkoutSetCount,
  formatWorkoutTime
} from '@/features/workout/workout-summary';
import { colors } from '@/theme/colors';
import type { WorkoutExerciseProgressResponse, WorkoutSessionResponse } from '@/types/api';

export default function WorkoutSessionScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
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
      Alert.alert(t('workout.saveFailed'), t('workout.progressKept'));
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
    onError: () => Alert.alert(t('workout.saveFailed'), t('workout.progressKept'))
  });
  const completeMutation = useMutation({
    mutationFn: (confirmPartialCompletion: boolean) =>
      completeWorkoutSession(sessionId!, { confirmPartialCompletion }),
    onSuccess: (next) => {
      updateSessionCache(next);
      void queryClient.invalidateQueries({ queryKey: ['workout-history'] });
    },
    onError: () => Alert.alert(t('workout.saveFailed'), t('workout.progressKept'))
  });

  if (!sessionId) {
    return <Screen><StateBlock title={t('workout.unavailable')} message={t('workout.unavailableMessage')} /></Screen>;
  }

  if (session.isLoading) {
    return <StateBlock title={t('workout.loading')} message={t('workout.loadingMessage')} />;
  }

  if (session.isError || !session.data) {
    return (
      <Screen>
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
    <Screen>
      <Text variant="heading">{completed ? t('workout.workoutCompleted') : t('workout.title')}</Text>
      <Text variant="muted">{formatWorkoutDate(data.summary.localDate, i18n.resolvedLanguage)}</Text>
      <Text variant="muted">{t('workout.progressSummary', {
        completedSets: String(data.completedSetCount),
        totalSets: String(data.plannedSetCount),
        completedExercises: String(data.completedExerciseCount),
        totalExercises: String(data.plannedExerciseCount)
      })}</Text>

      <Card>
        <Text variant="label">{completed ? t('workout.workoutSummary') : t('workout.progress')}</Text>
        <Text variant="body">{formatWorkoutFocus(data.summary, t)}</Text>
        <Text variant="muted">{formatWorkoutSetCount(data.summary, t)}</Text>
        <Text variant="muted">{formatWorkoutExerciseCount(data.summary, t)}</Text>
        {data.summary.isPartial ? <Text variant="muted">{t('workout.partialWorkoutSaved')}</Text> : null}
        <Text variant="muted">{t('workout.startedAt', { time: formatWorkoutTime(data.startedAt, i18n.resolvedLanguage) })}</Text>
        {data.completedAt ? (
          <Text variant="muted">{t('workout.completedAt', { time: formatWorkoutTime(data.completedAt, i18n.resolvedLanguage) })}</Text>
        ) : null}
      </Card>

      <Card>
        <Text variant="label">{t('workout.safetyNote')}</Text>
        <Text variant="body">{t('workout.safetyMessage')}</Text>
      </Card>

      {completed ? (
        <Card>
          <Text variant="label">{t('workout.readOnly')}</Text>
          <Text variant="muted">{t('workout.thisWorkoutCompleted')}</Text>
        </Card>
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
              Alert.alert(
                t('workout.partialTitle'),
                t('workout.partialMessage'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('workout.finishEarly'),
                    onPress: () => completeMutation.mutate(true)
                  }
                ]
              );
              return;
            }
            completeMutation.mutate(false);
          }}
        />
      ) : null}
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
  const hasSets = typeof progress.plannedSets === 'number' && progress.plannedSets > 0;
  const imageUrl = thumbnailUrl ? getExerciseMediaDisplayUrl(thumbnailUrl) : null;
  const prescription = formatPrescription(progress, {
    setsLabel: String(t('workout.setsLabel')),
    repsLabel: String(t('workout.repsLabel')),
    durationLabel: String(t('workout.durationLabel')),
    restLabel: String(t('workout.restLabel'))
  });

  return (
    <Card>
      <View style={styles.exerciseHeader}>
        <View style={styles.thumbnail}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} resizeMode="contain" style={styles.image} accessible={false} />
          ) : (
            <Ionicons name="barbell-outline" size={28} color={colors.primary} accessible={false} />
          )}
        </View>
        <View style={styles.exerciseTitle}>
          <Text variant="label" accessibilityRole="header">{progress.exerciseNameSnapshot}</Text>
          <Text variant="muted">{prescription}</Text>
        </View>
      </View>

      {hasSets ? (
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
                <Text style={checked ? styles.setTextChecked : styles.setText}>
                  {t('workout.setNumber', { number: String(index + 1) })}
                </Text>
              </Pressable>
            );
          })}
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

      {onOpenExercise ? (
        <Button title={t('plan.openExerciseDetails')} variant="secondary" onPress={onOpenExercise} />
      ) : null}
    </Card>
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

const styles = StyleSheet.create({
  exerciseHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  exerciseTitle: { flex: 1, gap: 4 },
  thumbnail: {
    width: 64,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  image: { width: '100%', height: '100%' },
  setGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setButton: {
    minHeight: 44,
    minWidth: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  setButtonChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  setText: { color: colors.ink, fontWeight: '700' },
  setTextChecked: { color: '#ffffff', fontWeight: '700' },
  pressed: { opacity: 0.78 }
});
