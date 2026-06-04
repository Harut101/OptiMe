import { useMutation, useQuery } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { getTodayPlan, submitDailyPlanFeedback } from '@/api/daily-plans';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
import type { PlanFeedbackRating, PlanFeedbackTag } from '@/types/api';

const feedbackTags: Array<{ label: string; value: PlanFeedbackTag }> = [
  { label: 'Too much food', value: 'TOO_MUCH_FOOD' },
  { label: 'Too little food', value: 'TOO_LITTLE_FOOD' },
  { label: 'Training too hard', value: 'TRAINING_TOO_HARD' },
  { label: 'Training too easy', value: 'TRAINING_TOO_EASY' },
  { label: 'Felt good', value: 'FELT_GOOD' },
  { label: 'Low energy', value: 'LOW_ENERGY' }
];

export default function PlanDetailsScreen() {
  const [rating, setRating] = useState<PlanFeedbackRating | null>(null);
  const [selectedTags, setSelectedTags] = useState<PlanFeedbackTag[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const today = useQuery({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan
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

      <Card>
        <Text variant="label">Meals</Text>
        {plan.nutrition.meals.map((meal) => (
          <Text key={meal.name} variant="body">
            {meal.name}: {meal.foods.map((food) => `${food.portion} ${food.name}`).join(', ')}
          </Text>
        ))}
      </Card>

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
  successText: {
    color: colors.success,
    fontWeight: '700'
  }
});
