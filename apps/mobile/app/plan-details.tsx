import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@optime/shared-types';

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
import { PlanTabbedContent } from '@/features/daily-plan/PlanTabbedContent';
import { colors } from '@/theme/colors';
import type {
  PlanFeedbackRating,
  PlanFeedbackTag
} from '@/types/api';

export default function PlanDetailsScreen() {
  const { t, i18n } = useTranslation();
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
  const handleRefresh = async () => {
    const refreshedToday = await today.refetch();
    const planId = refreshedToday.data?.id ?? today.data?.id;

    if (planId) {
      await queryClient.refetchQueries({ queryKey: ['daily-plan-check-ins', planId], type: 'active' });
    }
  };
  const refreshing = today.isRefetching || checkIns.isRefetching;

  if (today.isLoading) {
    return <StateBlock title={t('plan.loading')} message={t('plan.loadingMessage')} />;
  }

  const plan = today.data?.plan;
  const safetyMessage = getPlanSafetyMessage(today.data);

  if (!plan) {
    return (
      <Screen refreshing={refreshing} onRefresh={handleRefresh}>
        <StateBlock title={t('plan.noPlan')} message={t('plan.noPlanMessage')} />
      </Screen>
    );
  }

  const feedbackTags = getFeedbackTags(t);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      <Text variant="heading">{t('plan.title')}</Text>
      <Text variant="muted">{plan.summary.message}</Text>

      {safetyMessage ? (
        <Card>
          <Text variant="label">{t('today.safetyNote')}</Text>
          <Text variant="body">{safetyMessage}</Text>
        </Card>
      ) : null}

      <PlanTabbedContent
        planId={today.data!.id}
        plan={plan}
        checkIns={checkIns.data?.items}
        checkInPending={checkIn.isPending}
        locale={locale}
        t={t}
        onMealCheckIn={(mealIndex, mealName, status) => checkIn.mutate({
          dailyPlanId: today.data!.id,
          body: { type: 'MEAL', payload: { mealIndex, mealName, status } }
        })}
        onTrainingCheckIn={(status, painOrDiscomfort) => checkIn.mutate({
          dailyPlanId: today.data!.id,
          body: {
            type: 'TRAINING',
            payload: {
              status,
              ...(painOrDiscomfort ? { painOrDiscomfort: true, notes: 'Pain or discomfort reported.' } : {})
            }
          }
        })}
      />

      {checkInMessage ? <Text style={styles.successText}>{checkInMessage}</Text> : null}

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

function getFeedbackTags(
  t: (
    key:
      | 'plan.tagTooMuchFood'
      | 'plan.tagTooLittleFood'
      | 'plan.tagTrainingTooHard'
      | 'plan.tagTrainingTooEasy'
      | 'plan.tagFeltGood'
      | 'plan.tagLowEnergy'
  ) => string
): Array<{ label: string; value: PlanFeedbackTag }> {
  return [
    { label: t('plan.tagTooMuchFood'), value: 'TOO_MUCH_FOOD' },
    { label: t('plan.tagTooLittleFood'), value: 'TOO_LITTLE_FOOD' },
    { label: t('plan.tagTrainingTooHard'), value: 'TRAINING_TOO_HARD' },
    { label: t('plan.tagTrainingTooEasy'), value: 'TRAINING_TOO_EASY' },
    { label: t('plan.tagFeltGood'), value: 'FELT_GOOD' },
    { label: t('plan.tagLowEnergy'), value: 'LOW_ENERGY' }
  ];
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
