import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

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
  MealCheckInStatus,
  PlanFeedbackRating,
  PlanFeedbackTag,
  TrainingCheckInStatus
} from '@/types/api';

const feedbackTags: Array<{ label: string; value: PlanFeedbackTag }> = [
  { label: 'Too much food', value: 'TOO_MUCH_FOOD' },
  { label: 'Too little food', value: 'TOO_LITTLE_FOOD' },
  { label: 'Training too hard', value: 'TRAINING_TOO_HARD' },
  { label: 'Training too easy', value: 'TRAINING_TOO_EASY' },
  { label: 'Felt good', value: 'FELT_GOOD' },
  { label: 'Low energy', value: 'LOW_ENERGY' }
];

export default function PlanDetailsScreen() {
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
          ? "Thanks for letting us know. We'll use this to keep future training guidance more conservative."
          : "Thanks, we'll use this to adapt future plans."
      );
    },
    onError: (error) => Alert.alert('Check-in not saved', `${error.message}\n\nNo worries, your plan is still here.`)
  });
  const feedback = useMutation({
    mutationFn: () => {
      if (!today.data || !rating) {
        throw new Error('Choose Helpful or Not helpful first.');
      }

      return submitDailyPlanFeedback(today.data.id, {
        rating,
        tags: selectedTags
      });
    },
    onSuccess: () => setFeedbackMessage('Thanks for the feedback.'),
    onError: (error) => Alert.alert('Feedback not saved', error.message)
  });

  if (today.isLoading) {
    return <StateBlock title="Loading plan" message="Opening your plan details." />;
  }

  const plan = today.data?.plan;
  const safetyMessage = getPlanSafetyMessage(today.data);

  if (!plan) {
    return (
      <Screen>
        <StateBlock title="No plan yet" message="Generate a plan from Today to see details here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="heading">Plan details</Text>
      <Text variant="muted">{plan.summary.message}</Text>

      {safetyMessage ? (
        <Card>
          <Text variant="label">Safety note</Text>
          <Text variant="body">{safetyMessage}</Text>
        </Card>
      ) : null}

      <Card>
        <Text variant="label">Meals</Text>
        <Text variant="muted">How did each meal go? No worries if it changed - this helps us adapt.</Text>
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
        <Text variant="label">Training check-in</Text>
        <Text variant="muted">Tell us what happened. Resting instead is useful signal, not a failure.</Text>
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
          title="I felt pain or discomfort"
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
          We will keep future training guidance more conservative when discomfort is reported.
        </Text>
      </Card>

      {checkInMessage ? <Text style={styles.successText}>{checkInMessage}</Text> : null}

      <Card>
        <Text variant="label">Hydration</Text>
        <Text variant="body">{plan.nutrition.hydration.guidance}</Text>
        {plan.nutrition.hydration.notes ? (
          <Text variant="muted">{plan.nutrition.hydration.notes}</Text>
        ) : null}
      </Card>

      <Card>
        <Text variant="label">Recovery</Text>
        <Text variant="body">{plan.recovery.recommendation}</Text>
        {plan.recovery.sleepTip ? <Text variant="muted">{plan.recovery.sleepTip}</Text> : null}
        {plan.recovery.mobilityTip ? <Text variant="muted">{plan.recovery.mobilityTip}</Text> : null}
      </Card>

      <Card>
        <Text variant="label">Reminders</Text>
        {plan.reminders.map((reminder) => (
          <Text key={reminder} variant="body">
            {reminder}
          </Text>
        ))}
      </Card>

      <Card>
        <Text variant="label">Was this plan helpful?</Text>
        <View style={styles.row}>
          <Button
            title="Helpful"
            variant={rating === 'HELPFUL' ? 'primary' : 'secondary'}
            style={styles.choiceButton}
            onPress={() => setRating('HELPFUL')}
          />
          <Button
            title="Not helpful"
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
          title={feedback.isPending ? 'Saving...' : 'Send feedback'}
          disabled={!rating || feedback.isPending}
          onPress={() => feedback.mutate()}
        />
      </Card>
    </Screen>
  );
}

const mealStatuses: Array<{ label: string; value: MealCheckInStatus }> = [
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Partial', value: 'PARTIALLY_COMPLETED' },
  { label: 'Skipped', value: 'SKIPPED' },
  { label: 'Swapped', value: 'SWAPPED' }
];

const trainingStatuses: Array<{ label: string; value: TrainingCheckInStatus }> = [
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Partial', value: 'PARTIALLY_COMPLETED' },
  { label: 'Skipped', value: 'SKIPPED' },
  { label: 'Rested', value: 'RESTED_INSTEAD' }
];

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
  successText: {
    color: colors.success,
    fontWeight: '700'
  }
});
