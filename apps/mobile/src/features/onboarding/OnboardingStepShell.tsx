import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';

interface OnboardingStepShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  progressLabel: string;
  progressValue: number;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onBack?: () => void;
}

export function OnboardingStepShell({
  eyebrow,
  title,
  subtitle,
  progressLabel,
  progressValue,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
  onBack
}: OnboardingStepShellProps) {
  const safeProgress = Math.max(0, Math.min(progressValue, 1));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack ? (
          <Button
            title={eyebrow}
            variant="ghost"
            accessibilityLabel={eyebrow}
            onPress={onBack}
          />
        ) : (
          <Text variant="label" style={styles.eyebrow}>{eyebrow}</Text>
        )}
        <Text variant="largeTitle">{title}</Text>
        <Text variant="muted">{subtitle}</Text>
        <View accessible accessibilityLabel={progressLabel} accessibilityRole="progressbar" style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${safeProgress * 100}%` }]} />
        </View>
        <Text variant="caption">{progressLabel}</Text>
      </View>

      <Card variant="elevated" style={styles.contentCard}>
        {children}
      </Card>

      <View style={styles.actions}>
        <Button title={primaryLabel} loading={primaryLoading} disabled={primaryLoading} onPress={onPrimary} />
        {secondaryLabel && onSecondary ? (
          <Button title={secondaryLabel} variant="secondary" disabled={primaryLoading} onPress={onSecondary} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 18
  },
  header: {
    gap: 10
  },
  eyebrow: {
    color: colors.primaryDark,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 8,
    overflow: 'hidden'
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: '100%'
  },
  contentCard: {
    gap: 16
  },
  actions: {
    gap: 10,
    marginTop: 'auto',
    paddingBottom: 8
  }
});
