import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/theme-provider';
import type {
  DailyPlanCheckpointProposal,
  DailyPlanJson
} from '@/types/api';

interface PlanCheckpointReviewSheetProps {
  visible: boolean;
  proposal: DailyPlanCheckpointProposal | null;
  currentPlan: DailyPlanJson | null;
  isResolving: boolean;
  onApply: () => void;
  onKeep: () => void;
  onClose: () => void;
}

export function PlanCheckpointReviewSheet({
  visible,
  proposal,
  currentPlan,
  isResolving,
  onApply,
  onKeep,
  onClose
}: PlanCheckpointReviewSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <BottomSheet
      visible={visible && Boolean(proposal)}
      title={t('checkpoint.title')}
      subtitle={t('checkpoint.subtitle')}
      onClose={onClose}
    >
      {proposal ? (
        <>
          <View style={styles.comparison}>
            <View style={styles.section}>
              <Text variant="label">{t('checkpoint.currentPlan')}</Text>
              <Text variant="bodyStrong">
                {currentPlan?.summary.title ?? t('checkpoint.currentPlan')}
              </Text>
              {currentPlan?.summary.message ? (
                <Text variant="muted">{currentPlan.summary.message}</Text>
              ) : null}
            </View>
            <View style={styles.divider} />
            <View style={styles.section}>
              <Text variant="label" style={styles.suggestedLabel}>
                {t('checkpoint.suggestedUpdate')}
              </Text>
              <Text variant="bodyStrong">{proposal.summary.title}</Text>
              <Text variant="muted">{proposal.summary.message}</Text>
            </View>
          </View>

          {proposal.affectedSections.length > 0 ? (
            <View style={styles.changedAreas}>
              <Text variant="label">{t('checkpoint.changedAreas')}</Text>
              <View style={styles.chips}>
                {proposal.affectedSections.map((section) => (
                  <View key={section} style={styles.chip}>
                    <Text variant="caption">
                      {t(`checkpoint.sections.${section}` as never)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <Text variant="caption" style={styles.trustNote}>
            {t('checkpoint.trustNote')}
          </Text>
          <View style={styles.actions}>
            <Button
              title={isResolving ? t('checkpoint.applying') : t('checkpoint.apply')}
              disabled={isResolving}
              onPress={onApply}
            />
            <Button
              title={t('checkpoint.keep')}
              variant="secondary"
              disabled={isResolving}
              onPress={onKeep}
            />
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    comparison: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 22,
      padding: 16
    },
    section: {
      gap: 5
    },
    divider: {
      backgroundColor: colors.divider,
      height: StyleSheet.hairlineWidth,
      marginVertical: 15
    },
    suggestedLabel: {
      color: colors.info
    },
    changedAreas: {
      gap: 9
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8
    },
    chip: {
      backgroundColor: colors.infoMuted,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 7
    },
    trustNote: {
      color: colors.textSecondary
    },
    actions: {
      gap: 10
    }
  });
