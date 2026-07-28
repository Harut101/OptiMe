import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { Text } from '@/components/Text';
import type { ThemeColors } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import type { EvaluatePlanImpactResponse } from '@/types/api';

interface PlanImpactPromptCardProps {
  impact: EvaluatePlanImpactResponse | null;
  isUpdating?: boolean;
  errorMessage?: string | null;
  onUpdateToday: () => void;
  onFutureOnly: () => void;
}

/**
 * Plan impact is a time-sensitive decision, not persistent dashboard content.
 * It opens as an action sheet after a planning-sensitive change.
 */
export function PlanImpactPromptCard({
  impact,
  isUpdating = false,
  errorMessage,
  onUpdateToday,
  onFutureOnly
}: PlanImpactPromptCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [impact]);

  if (!impact?.prompt) return null;

  const prompt = impact.prompt;
  const title = t(`planImpact.titles.${prompt.titleCode}` as never);
  const message = t(`planImpact.messages.${prompt.messageCode}` as never);
  const primaryLabel = t(`planImpact.actions.${prompt.primaryAction}` as never);
  const secondaryLabel = t(`planImpact.actions.${prompt.secondaryAction}` as never);

  return (
    <BottomSheet visible={!dismissed} title={title} onClose={() => setDismissed(true)}>
      <View style={styles.copy}>
        <Text variant="label" style={styles.eyebrow}>{t('planImpact.label')}</Text>
        <Text variant="body">{message}</Text>
      </View>

      {prompt.safetyCritical ? (
        <ContextNoteCard
          title={t('planImpact.safetyTitle')}
          message={t('planImpact.safetyMessage')}
          tone="warning"
        />
      ) : null}

      <Text variant="muted">
        {prompt.requiresAiGeneration
          ? prompt.usageCost
            ? t('planImpact.usesGeneration', { count: prompt.usageCost })
            : t('planImpact.mayUseGeneration')
          : t('planImpact.noGenerationNeeded')}
      </Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.actions}>
        <Button
          title={isUpdating ? t('today.refreshing') : primaryLabel}
          loading={isUpdating}
          onPress={onUpdateToday}
        />
        <Button
          title={secondaryLabel}
          variant="secondary"
          disabled={isUpdating}
          onPress={onFutureOnly}
        />
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  copy: { gap: 8 },
  eyebrow: { color: colors.health },
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '700' }
});
