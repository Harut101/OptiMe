import { useMutation, useQuery } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLocale } from '@optime/shared-types';

import { getTodayPlan, submitDailyPlanFeedback } from '@/api/daily-plans';
import { Button } from '@/components/Button';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { ScreenSkeleton } from '@/components/ScreenSkeleton';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { getPlanSafetyMessage } from '@/features/safety/safety-copy';
import { DailyTrainingPlanContent } from '@/features/daily-plan/PlanTabbedContent';
import { getContextNoteMessage, getContextNoteTitle } from '@/features/daily-plan/context-note-copy';
import { colors } from '@/theme/colors';
import type {
  PlanFeedbackRating,
  PlanFeedbackTag
} from '@/types/api';

export default function PlanDetailsScreen() {
  const { t, i18n } = useTranslation();
  const [rating, setRating] = useState<PlanFeedbackRating | null>(null);
  const [selectedTags, setSelectedTags] = useState<PlanFeedbackTag[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackErrorVisible, setFeedbackErrorVisible] = useState(false);
  const today = useQuery({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan
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
    onError: () => setFeedbackErrorVisible(true)
  });
  const handleRefresh = async () => {
    await today.refetch();
  };
  const refreshing = today.isRefetching;

  if (today.isLoading) {
    return <ScreenSkeleton variant="detail" cardCount={4} />;
  }

  const plan = today.data?.plan;
  const safetyMessage = getPlanSafetyMessage(today.data, t);

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
      <ScreenHeader title={t('plan.title')} subtitle={plan.summary.message} />

      {safetyMessage ? (
        <ContextNoteCard title={t('today.safetyNote')} message={safetyMessage} tone="warning" />
      ) : null}

      <DailyTrainingPlanContent
        planId={today.data!.id}
        plan={plan}
        locale={locale}
        t={t}
      />

      {plan.contextNotes?.trainingLoad ? (
        <ContextNoteCard
          title={getContextNoteTitle(t, plan.contextNotes.trainingLoad.titleCode)}
          message={getContextNoteMessage(t, plan.contextNotes.trainingLoad.messageCode)}
        />
      ) : null}

      <Card>
        <SectionHeader title={t('plan.recovery')} />
        <Text variant="body">{plan.recovery.recommendation}</Text>
        {plan.contextNotes?.recovery ? (
          <Text variant="muted">
            {getContextNoteMessage(t, plan.contextNotes.recovery.messageCode)}
          </Text>
        ) : null}
        {plan.recovery.sleepTip ? <Text variant="muted">{plan.recovery.sleepTip}</Text> : null}
        {plan.recovery.mobilityTip ? <Text variant="muted">{plan.recovery.mobilityTip}</Text> : null}
      </Card>

      <Card>
        <SectionHeader title={t('plan.reminders')} />
        {plan.reminders.map((reminder) => (
          <Text key={reminder} variant="body">
            {reminder}
          </Text>
        ))}
      </Card>

      <FeedbackTrigger
        title={t('plan.helpfulQuestion')}
        actionLabel={t('plan.sendFeedback')}
        message={feedbackMessage}
        onPress={() => setFeedbackVisible(true)}
      />

      <BottomSheet
        visible={feedbackVisible}
        title={t('plan.helpfulQuestion')}
        onClose={() => setFeedbackVisible(false)}
      >
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
        {feedbackMessage ? <ContextNoteCard title={t('common.saved')} message={feedbackMessage} tone="success" /> : null}
        <Button
          title={feedback.isPending ? t('common.saving') : t('plan.sendFeedback')}
          disabled={!rating || feedback.isPending}
          onPress={() => {
            feedback.mutate();
            setFeedbackVisible(false);
          }}
        />
      </BottomSheet>
      <AppFeedbackSheet
        visible={feedbackErrorVisible}
        title={t('plan.feedbackFailed')}
        message={t('errors.unableSave')}
        tone="warning"
        onClose={() => setFeedbackErrorVisible(false)}
        actions={[
          {
            label: t('common.close'),
            variant: 'secondary',
            onPress: () => setFeedbackErrorVisible(false)
          }
        ]}
      />
    </Screen>
  );
}

function FeedbackTrigger({
  title,
  actionLabel,
  message,
  onPress
}: {
  title: string;
  actionLabel: string;
  message: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.feedbackTrigger, pressed ? styles.feedbackTriggerPressed : null]}
    >
      <View style={styles.feedbackTriggerCopy}>
        <Text variant="label">{title}</Text>
        {message ? <Text variant="muted">{message}</Text> : null}
      </View>
      <Text style={styles.feedbackTriggerAction}>{actionLabel}</Text>
    </Pressable>
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
  feedbackTrigger: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: 'rgba(209, 209, 214, 0.65)',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2
  },
  feedbackTriggerPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }]
  },
  feedbackTriggerCopy: {
    flex: 1,
    gap: 3
  },
  feedbackTriggerAction: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900'
  },
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
  }
});
