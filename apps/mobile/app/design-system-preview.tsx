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
  lightTheme,
  uiColors
} from '@/ui';

export default function DesignSystemPreviewScreen() {
  const { t } = useTranslation();
  const colorEntries = Object.entries(uiColors);
  const iconNames = ['today', 'food', 'training', 'profile', 'schedule', 'goal', 'health', 'safety', 'settings'] as const;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <AppText variant="title">{t('designSystem.title')}</AppText>
      <AppText variant="muted">{t('designSystem.intro')}</AppText>

      <UICard>
        <AppText variant="heading">{t('designSystem.colors')}</AppText>
        <View style={styles.swatchGrid}>
          {colorEntries.map(([name, value]) => (
            <View key={name} style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: value }]} />
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
  iconItem: { width: 72, alignItems: 'center', gap: lightTheme.spacing.xs }
});
