import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DailyPlanJson } from '@/types/api';
import { colors } from '@/theme/colors';
import { BottomSheet } from './BottomSheet';
import { Card } from './Card';
import { Text } from './Text';

interface AICoachBottomSheetProps {
  visible: boolean;
  plan: DailyPlanJson | null | undefined;
  onClose: () => void;
}

export function AICoachBottomSheet({ visible, plan, onClose }: AICoachBottomSheetProps) {
  const { t } = useTranslation();

  return (
    <BottomSheet
      visible={visible}
      title="AI Coach"
      subtitle={plan?.summary.title ?? 'Daily guidance'}
      onClose={onClose}
    >
      {plan ? (
        <>
          <Text variant="body">{plan.summary.message}</Text>
          <CoachSection title={t('today.nutrition')} body={plan.nutrition.calorieGuidance.notes} />
          <CoachSection title={t('today.training')} body={plan.training.recommendation} helper={plan.training.notes} />
          <CoachSection title={t('today.recovery')} body={plan.recovery.recommendation} helper={plan.recovery.sleepTip ?? plan.recovery.mobilityTip} />
          {plan.safety.userSafeMessage ? (
            <Card variant="muted">
              <Text variant="body" style={styles.safetyTitle}>{t('today.safetyNote')}</Text>
              <Text variant="muted">{plan.safety.userSafeMessage}</Text>
            </Card>
          ) : null}
        </>
      ) : (
        <Text variant="muted">Create today's plan to see concise coach guidance.</Text>
      )}
    </BottomSheet>
  );
}

function CoachSection({ title, body, helper }: { title: string; body: string; helper?: string }) {
  return (
    <View style={styles.section}>
      <Text variant="label" style={styles.label}>{title}</Text>
      <Text variant="body">{body}</Text>
      {helper ? <Text variant="muted">{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    gap: 5,
    paddingBottom: 13
  },
  label: {
    color: colors.health
  },
  safetyTitle: {
    color: colors.warning,
    fontWeight: '800'
  }
});
