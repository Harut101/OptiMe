import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  getDailyPlanCheckIns,
  getTodayPlan,
  submitDailyPlanCheckIn,
  submitDailyPlanFeedback
} from '@/api/daily-plans';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { getPlanSafetyMessage } from '@/features/safety/safety-copy';
import { colors } from '@/theme/colors';
import type {
  DailyPlanCheckInResponse,
  DailyPlanExercise,
  MealCheckInStatus,
  PlanFeedbackRating,
  PlanFeedbackTag,
  TrainingCheckInStatus
} from '@/types/api';

export default function PlanDetailsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState<PlanFeedbackRating | null>(null);
  const [selectedTags, setSelectedTags] = useState<PlanFeedbackTag[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const today = useQuery({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan
  });
  const checkIns = useQuery({
    queryKey: ['daily-plan-check-ins', today.data?.id],
    queryFn: () => getDailyPlanCheckIns(today.data!.id),
    enabled: Boolean(today.data?.id)
  });
  const checkIn = useMutation({
    mutationFn: ({
      dailyPlanId,
      body
    }: {
      dailyPlanId: string;
      body: Parameters<typeof submitDailyPlanCheckIn>[1];
    }) => submitDailyPlanCheckIn(dailyPlanId, body),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['daily-plan-check-ins', today.data?.id] });
      const payload = variables.body.payload;
      const reportedPain =
        variables.body.type === 'TRAINING' &&
        'painOrDiscomfort' in payload &&
        payload.painOrDiscomfort;

      setCheckInMessage(
        reportedPain
          ? t('plan.painThanks')
          : t('plan.checkInThanks')
      );
    },
    onError: () => Alert.alert(t('plan.checkInFailed'), `${t('errors.unableSave')}\n\n${t('plan.planStillHere')}`)
  });
  const feedback = useMutation({
    mutationFn: () => {
      if (!today.data || !rating) {
        throw new Error(t('plan.chooseRating'));
      }

      return submitDailyPlanFeedback(today.data.id, {
        rating,
        tags: selectedTags
      });
    },
    onSuccess: () => setFeedbackMessage(t('plan.feedbackThanks')),
    onError: () => Alert.alert(t('plan.feedbackFailed'), t('errors.unableSave'))
  });

  if (today.isLoading) {
    return <StateBlock title={t('plan.loading')} message={t('plan.loadingMessage')} />;
  }

  const plan = today.data?.plan;
  const safetyMessage = getPlanSafetyMessage(today.data);

  if (!plan) {
    return (
      <Screen>
        <StateBlock title={t('plan.noPlan')} message={t('plan.noPlanMessage')} />
      </Screen>
    );
  }

  const exercises = Array.isArray(plan.training.exercises) ? plan.training.exercises : [];
  const feedbackTags = getFeedbackTags(t);
  const mealStatuses = getMealStatuses(t);
  const trainingStatuses = getTrainingStatuses(t);

  return (
    <Screen>
      <Text variant="heading">{t('plan.title')}</Text>
      <Text variant="muted">{plan.summary.message}</Text>

      {safetyMessage ? (
        <Card>
          <Text variant="label">{t('today.safetyNote')}</Text>
          <Text variant="body">{safetyMessage}</Text>
        </Card>
      ) : null}

      <Card>
        <Text variant="label">{t('plan.meals')}</Text>
        <Text variant="muted">{t('plan.mealsHelp')}</Text>
        {plan.nutrition.meals.map((meal, index) => {
          const currentStatus = getMealCheckInStatus(checkIns.data?.items, index);

          return (
            <View key={`${meal.name}-${index}`} style={styles.mealBlock}>
              <Text variant="body">
                {meal.name}: {meal.foods.map((food) => `${food.portion} ${food.name}`).join(', ')}
              </Text>
              <View style={styles.tagRow}>
                {mealStatuses.map((status) => (
                  <Button
                    key={status.value}
                    title={status.label}
                    variant={currentStatus === status.value ? 'primary' : 'secondary'}
                    style={styles.checkInButton}
                    disabled={checkIn.isPending}
                    onPress={() => {
                      if (!today.data) return;
                      checkIn.mutate({
                        dailyPlanId: today.data.id,
                        body: {
                          type: 'MEAL',
                          payload: {
                            mealIndex: index,
                            mealName: meal.name,
                            status: status.value
                          }
                        }
                      });
                    }}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text variant="label">{t('plan.trainingCheckIn')}</Text>
        <Text variant="muted">{t('plan.trainingHelp')}</Text>
        <View style={styles.tagRow}>
          {trainingStatuses.map((status) => (
            <Button
              key={status.value}
              title={status.label}
              variant={getTrainingCheckInStatus(checkIns.data?.items) === status.value ? 'primary' : 'secondary'}
              style={styles.checkInButton}
              disabled={checkIn.isPending}
              onPress={() => {
                if (!today.data) return;
                checkIn.mutate({
                  dailyPlanId: today.data.id,
                  body: {
                    type: 'TRAINING',
                    payload: {
                      status: status.value
                    }
                  }
                });
              }}
            />
          ))}
        </View>
        <Button
          title={t('plan.pain')}
          variant={getTrainingPainSignal(checkIns.data?.items) ? 'danger' : 'secondary'}
          disabled={checkIn.isPending}
          onPress={() => {
            if (!today.data) return;
            checkIn.mutate({
              dailyPlanId: today.data.id,
              body: {
                type: 'TRAINING',
                payload: {
                  status: getTrainingCheckInStatus(checkIns.data?.items) ?? 'RESTED_INSTEAD',
                  painOrDiscomfort: true,
                  notes: 'Pain or discomfort reported.'
                }
              }
            });
          }}
        />
        <Text variant="muted">
          {t('plan.painHelp')}
        </Text>
      </Card>

      {checkInMessage ? <Text style={styles.successText}>{checkInMessage}</Text> : null}

      {exercises.length > 0 ? (
        <Card>
          <Text variant="label">{t('plan.exercises')}</Text>
          {exercises.map((exercise, index) => (
            <View key={`${exercise.name}-${index}`} style={styles.exerciseBlock}>
              <Text variant="body" style={styles.exerciseName}>
                {exercise.name}
              </Text>
              {formatExerciseMeta(exercise, t) ? (
                <Text variant="muted">{formatExerciseMeta(exercise, t)}</Text>
              ) : null}
              {formatExercisePrescription(exercise, t) ? (
                <Text variant="body">{formatExercisePrescription(exercise, t)}</Text>
              ) : null}
              {exercise.intensityCue ? (
                <Text variant="muted">{exercise.intensityCue}</Text>
              ) : null}
              {exercise.safetyNotes ? (
                <View style={styles.safetyNote}>
                  <Text variant="muted">{exercise.safetyNotes}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text variant="label">{t('plan.hydration')}</Text>
        <Text variant="body">{plan.nutrition.hydration.guidance}</Text>
        {plan.nutrition.hydration.notes ? (
          <Text variant="muted">{plan.nutrition.hydration.notes}</Text>
        ) : null}
      </Card>

      <Card>
        <Text variant="label">{t('plan.recovery')}</Text>
        <Text variant="body">{plan.recovery.recommendation}</Text>
        {plan.recovery.sleepTip ? <Text variant="muted">{plan.recovery.sleepTip}</Text> : null}
        {plan.recovery.mobilityTip ? <Text variant="muted">{plan.recovery.mobilityTip}</Text> : null}
      </Card>

      <Card>
        <Text variant="label">{t('plan.reminders')}</Text>
        {plan.reminders.map((reminder) => (
          <Text key={reminder} variant="body">
            {reminder}
          </Text>
        ))}
      </Card>

      <Card>
        <Text variant="label">{t('plan.helpfulQuestion')}</Text>
        <View style={styles.row}>
          <Button
            title={t('plan.helpful')}
            variant={rating === 'HELPFUL' ? 'primary' : 'secondary'}
            style={styles.choiceButton}
            onPress={() => setRating('HELPFUL')}
          />
          <Button
            title={t('plan.notHelpful')}
            variant={rating === 'NOT_HELPFUL' ? 'primary' : 'secondary'}
            style={styles.choiceButton}
            onPress={() => setRating('NOT_HELPFUL')}
          />
        </View>
        <View style={styles.tagRow}>
          {feedbackTags.map((tag) => {
            const active = selectedTags.includes(tag.value);

            return (
              <Button
                key={tag.value}
                title={tag.label}
                variant={active ? 'primary' : 'secondary'}
                style={styles.tagButton}
                onPress={() => toggleTag(tag.value, setSelectedTags)}
              />
            );
          })}
        </View>
        {feedbackMessage ? <Text style={styles.successText}>{feedbackMessage}</Text> : null}
        <Button
          title={feedback.isPending ? t('common.saving') : t('plan.sendFeedback')}
          disabled={!rating || feedback.isPending}
          onPress={() => feedback.mutate()}
        />
      </Card>
    </Screen>
  );
}

function getMealStatuses(t: ReturnType<typeof useTranslation>['t']): Array<{ label: string; value: MealCheckInStatus }> {
  return [
    { label: t('plan.statusCompleted'), value: 'COMPLETED' },
    { label: t('plan.statusPartial'), value: 'PARTIALLY_COMPLETED' },
    { label: t('plan.statusSkipped'), value: 'SKIPPED' },
    { label: t('plan.statusSwapped'), value: 'SWAPPED' }
  ];
}

function getTrainingStatuses(t: ReturnType<typeof useTranslation>['t']): Array<{ label: string; value: TrainingCheckInStatus }> {
  return [
    { label: t('plan.statusCompleted'), value: 'COMPLETED' },
    { label: t('plan.statusPartial'), value: 'PARTIALLY_COMPLETED' },
    { label: t('plan.statusSkipped'), value: 'SKIPPED' },
    { label: t('plan.statusRested'), value: 'RESTED_INSTEAD' }
  ];
}

function getFeedbackTags(t: ReturnType<typeof useTranslation>['t']): Array<{ label: string; value: PlanFeedbackTag }> {
  return [
    { label: t('plan.tagTooMuchFood'), value: 'TOO_MUCH_FOOD' },
    { label: t('plan.tagTooLittleFood'), value: 'TOO_LITTLE_FOOD' },
    { label: t('plan.tagTrainingTooHard'), value: 'TRAINING_TOO_HARD' },
    { label: t('plan.tagTrainingTooEasy'), value: 'TRAINING_TOO_EASY' },
    { label: t('plan.tagFeltGood'), value: 'FELT_GOOD' },
    { label: t('plan.tagLowEnergy'), value: 'LOW_ENERGY' }
  ];
}

function getMealCheckInStatus(checkIns: DailyPlanCheckInResponse[] | undefined, mealIndex: number) {
  const checkIn = checkIns?.find(
    (item) => item.type === 'MEAL' && item.subjectKey === `meal:${mealIndex}`
  );

  return checkIn?.payload && 'status' in checkIn.payload
    ? (checkIn.payload.status as MealCheckInStatus)
    : null;
}

function getTrainingCheckInStatus(checkIns: DailyPlanCheckInResponse[] | undefined) {
  const checkIn = checkIns?.find((item) => item.type === 'TRAINING');

  return checkIn?.payload && 'status' in checkIn.payload
    ? (checkIn.payload.status as TrainingCheckInStatus)
    : null;
}

function getTrainingPainSignal(checkIns: DailyPlanCheckInResponse[] | undefined) {
  const checkIn = checkIns?.find((item) => item.type === 'TRAINING');

  return Boolean(checkIn?.payload && 'painOrDiscomfort' in checkIn.payload && checkIn.payload.painOrDiscomfort);
}

function formatExerciseMeta(exercise: DailyPlanExercise, t: ReturnType<typeof useTranslation>['t']) {
  const parts = [
    exercise.targetMuscles?.length ? t('plan.targets', { value: exercise.targetMuscles.join(', ') }) : null,
    exercise.equipment?.length ? t('plan.equipment', { value: exercise.equipment.join(', ') }) : null
  ].filter(Boolean);

  return parts.join(' - ');
}

function formatExercisePrescription(exercise: DailyPlanExercise, t: ReturnType<typeof useTranslation>['t']) {
  return [
    exercise.sets ? t('plan.sets', { value: exercise.sets }) : null,
    exercise.reps ? t('plan.reps', { value: exercise.reps }) : null,
    exercise.rest ? t('plan.rest', { value: exercise.rest }) : null,
    exercise.duration ? t('plan.duration', { value: exercise.duration }) : null
  ]
    .filter(Boolean)
    .join(' - ');
}

function toggleTag(
  tag: PlanFeedbackTag,
  setSelectedTags: Dispatch<SetStateAction<PlanFeedbackTag[]>>
) {
  setSelectedTags((current) =>
    current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10
  },
  choiceButton: {
    flex: 1
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  tagButton: {
    minHeight: 42,
    paddingHorizontal: 12
  },
  checkInButton: {
    minHeight: 40,
    paddingHorizontal: 10
  },
  mealBlock: {
    gap: 8,
    paddingTop: 6
  },
  exerciseBlock: {
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  exerciseName: {
    fontWeight: '700'
  },
  safetyNote: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 10
  },
  successText: {
    color: colors.success,
    fontWeight: '700'
  }
});
