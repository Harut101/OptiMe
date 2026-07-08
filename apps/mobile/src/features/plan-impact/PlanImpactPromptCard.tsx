import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
import type { EvaluatePlanImpactResponse } from '@/types/api';

interface PlanImpactPromptCardProps {
  impact: EvaluatePlanImpactResponse | null;
  isUpdating?: boolean;
  errorMessage?: string | null;
  onUpdateToday: () => void;
  onFutureOnly: () => void;
}

export function PlanImpactPromptCard({
  impact,
  isUpdating = false,
  errorMessage,
  onUpdateToday,
  onFutureOnly
}: PlanImpactPromptCardProps) {
  const { t } = useTranslation();

  if (!impact?.prompt) return null;

  const prompt = impact.prompt;
  const title = t(`planImpact.titles.${prompt.titleCode}` as never);
  const message = t(`planImpact.messages.${prompt.messageCode}` as never);
  const primaryLabel = t(`planImpact.actions.${prompt.primaryAction}` as never);
  const secondaryLabel = t(`planImpact.actions.${prompt.secondaryAction}` as never);

  return (
    <Card>
      <View style={styles.header}>
        <View style={[styles.accent, prompt.safetyCritical ? styles.safety : styles.standard]} />
        <View style={styles.copy}>
          <Text variant="label">{t('planImpact.label')}</Text>
          <Text variant="heading">{title}</Text>
          <Text variant="muted">{message}</Text>
        </View>
      </View>

      {prompt.safetyCritical ? (
        <ContextNoteCard
          title={t('planImpact.safetyTitle')}
          message={t('planImpact.safetyMessage')}
          tone="warning"
        />
      ) : null}

      {prompt.requiresAiGeneration ? (
        <Text variant="muted">
          {prompt.usageCost
            ? t('planImpact.usesGeneration', { count: prompt.usageCost })
            : t('planImpact.mayUseGeneration')}
        </Text>
      ) : (
        <Text variant="muted">{t('planImpact.noGenerationNeeded')}</Text>
      )}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <View style={styles.actions}>
        <Button
          title={isUpdating ? t('today.refreshing') : primaryLabel}
          disabled={isUpdating}
          onPress={onUpdateToday}
          style={styles.actionButton}
        />
        <Button
          title={secondaryLabel}
          variant="secondary"
          disabled={isUpdating}
          onPress={onFutureOnly}
          style={styles.actionButton}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: 12
  },
  accent: {
    borderRadius: 999,
    width: 5
  },
  standard: {
    backgroundColor: colors.primary
  },
  safety: {
    backgroundColor: colors.warning
  },
  copy: {
    flex: 1,
    gap: 6
  },
  actions: {
    flexDirection: 'row',
    gap: 10
  },
  actionButton: {
    flex: 1
  },
  error: {
    color: colors.danger,
    fontWeight: '700'
  }
});
