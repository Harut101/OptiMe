import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppIcon,
  AppText,
  Chip,
  EmptyState,
  ErrorState,
  ProgressBar,
  UIButton,
  UICard,
  darkTheme,
  lightTheme,
  uiDarkColors,
  uiColors
} from '@/ui';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { MetricCard } from '@/components/MetricCard';
import { StatusPill } from '@/components/StatusPill';

export default function DesignSystemPreviewScreen() {
  const { t } = useTranslation();
  const lightColorEntries = Object.entries(uiColors);
  const darkColorEntries = Object.entries(uiDarkColors);
  const semanticEntries = [
    ['nutrition', uiColors.nutrition, uiColors.nutritionMuted],
    ['training', uiColors.training, uiColors.trainingMuted],
    ['recovery', uiColors.recovery, uiColors.recoveryMuted],
    ['health', uiColors.health, uiColors.healthMuted],
    ['success', uiColors.success, uiColors.successMuted],
    ['warning', uiColors.warning, uiColors.warningMuted],
    ['danger', uiColors.danger, uiColors.dangerMuted],
    ['info', uiColors.info, uiColors.infoMuted]
  ] as const;
  const iconNames = ['today', 'food', 'training', 'profile', 'schedule', 'goal', 'health', 'safety', 'settings'] as const;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <AppText variant="title">{t('designSystem.title')}</AppText>
      <AppText variant="muted">{t('designSystem.intro')}</AppText>

      <UICard>
        <AppText variant="heading">{t('designSystem.lightTheme')}</AppText>
        <View style={styles.swatchGrid}>
          {lightColorEntries.map(([name, value]) => (
            <View key={name} style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: value }]} />
              <AppText variant="caption">{name}</AppText>
            </View>
          ))}
        </View>
      </UICard>

      <UICard style={styles.darkCard}>
        <AppText variant="heading" style={styles.darkText}>{t('designSystem.darkTheme')}</AppText>
        <View style={styles.swatchGrid}>
          {darkColorEntries.map(([name, value]) => (
            <View key={name} style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: value, borderColor: darkTheme.colors.border }]} />
              <AppText variant="caption" style={styles.darkMuted}>{name}</AppText>
            </View>
          ))}
        </View>
      </UICard>

      <UICard>
        <AppText variant="heading">{t('designSystem.semanticColors')}</AppText>
        <View style={styles.semanticGrid}>
          {semanticEntries.map(([name, color, muted]) => (
            <View key={name} style={[styles.semanticCard, { backgroundColor: muted }]}>
              <View style={[styles.semanticDot, { backgroundColor: color }]} />
              <AppText variant="caption">{name}</AppText>
            </View>
          ))}
        </View>
      </UICard>

      <UICard>
        <AppText variant="heading">{t('designSystem.typography')}</AppText>
        <AppText variant="title">Title</AppText>
        <AppText variant="heading">Heading</AppText>
        <AppText>Body text for everyday guidance.</AppText>
        <AppText variant="muted">Muted supporting copy.</AppText>
        <AppText variant="label">Label</AppText>
      </UICard>

      <UICard>
        <AppText variant="heading">{t('designSystem.components')}</AppText>
        <UIButton title={t('common.save')} icon="completed" />
        <UIButton title={t('common.edit')} icon="edit" variant="secondary" />
        <View style={styles.row}>
          <Chip label={t('appModes.nutritionOnly')} selected />
          <Chip label={t('appModes.nutritionTraining')} />
        </View>
        <ProgressBar value={0.62} />
        <View style={styles.row}>
          <StatusPill label={t('today.nutrition')} tone="nutrition" />
          <StatusPill label={t('today.training')} tone="training" />
          <StatusPill label={t('today.recovery')} tone="recovery" />
          <StatusPill label={t('health.title')} tone="health" />
        </View>
        <MetricCard label={t('health.recoveryScore')} value={78} hint={t('health.wearableDataConnected')} />
        <ContextNoteCard
          title={t('contextNotes.recoveryTitle')}
          message={t('contextNotes.gentlerRecovery')}
          tone="recovery"
        />
      </UICard>

      <UICard>
        <AppText variant="heading">{t('designSystem.icons')}</AppText>
        <View style={styles.iconGrid}>
          {iconNames.map((name) => (
            <View key={name} style={styles.iconItem}>
              <AppIcon name={name} color={lightTheme.colors.brand} />
              <AppText variant="caption">{name}</AppText>
            </View>
          ))}
        </View>
      </UICard>

      <EmptyState title={t('designSystem.emptyState')} message={t('designSystem.emptyMessage')} />
      <ErrorState title={t('designSystem.errorState')} message={t('designSystem.errorMessage')} actionTitle={t('common.retry')} onAction={() => undefined} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: lightTheme.spacing.lg,
    padding: lightTheme.spacing.lg,
    backgroundColor: lightTheme.colors.background
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: lightTheme.spacing.sm },
  swatchGrid: { gap: lightTheme.spacing.sm },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: lightTheme.spacing.sm },
  swatch: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: lightTheme.colors.border },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: lightTheme.spacing.md },
  iconItem: { width: 72, alignItems: 'center', gap: lightTheme.spacing.xs },
  darkCard: {
    backgroundColor: darkTheme.colors.card,
    borderColor: darkTheme.colors.border
  },
  darkText: {
    color: darkTheme.colors.textPrimary
  },
  darkMuted: {
    color: darkTheme.colors.textSecondary
  },
  semanticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: lightTheme.spacing.sm
  },
  semanticCard: {
    minWidth: '45%',
    borderRadius: lightTheme.radius.lg,
    padding: lightTheme.spacing.md,
    gap: lightTheme.spacing.sm
  },
  semanticDot: {
    width: 28,
    height: 6,
    borderRadius: lightTheme.radius.pill
  }
});
