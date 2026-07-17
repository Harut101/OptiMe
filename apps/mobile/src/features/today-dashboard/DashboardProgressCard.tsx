import { StyleSheet, View, ViewStyle } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/theme-provider';
import { CircularProgressRing } from './CircularProgressRing';

type DashboardProgressTone = 'nutrition' | 'training';

interface DashboardProgressCardProps {
  title: string;
  value: number | null;
  centerLabel?: string;
  subtitle: string;
  hint?: string;
  tone: DashboardProgressTone;
  accessibilityLabel: string;
  style?: ViewStyle;
}

export const dashboardRingGradients = {
  nutrition: ['#00C8B3', '#34C759'],
  training: ['#0088FF', '#6155F5', '#CB30E0'],
  rest: ['#5CB8FF', '#0091FF']
} as const;

export function DashboardProgressCard({
  title,
  value,
  centerLabel,
  subtitle,
  hint,
  tone,
  accessibilityLabel,
  style
}: DashboardProgressCardProps) {
  const { colors } = useTheme();
  const isRestLikeState = value === null && centerLabel && centerLabel !== '-';
  const ringTone = isRestLikeState ? 'rest' : tone;
  const trackColor = ringTone === 'nutrition'
    ? colors.nutritionMuted
    : ringTone === 'training'
      ? colors.trainingMuted
      : colors.infoMuted;

  return (
    <Card style={[styles.cardShell, style]}>
      <View style={styles.card} accessible accessibilityLabel={accessibilityLabel}>
        <View style={styles.ringSlot}>
          <CircularProgressRing
            value={value}
            size={110}
            strokeWidth={16}
            label={centerLabel}
            gradientColors={dashboardRingGradients[ringTone]}
            trackColor={trackColor}
            trackOpacity={0.92}
            endCapColor={dashboardRingGradients[ringTone][dashboardRingGradients[ringTone].length - 1]}
            emptyArcValue={isRestLikeState ? 18 : 0}
            accessibilityLabel={accessibilityLabel}
          />
        </View>
        <View style={styles.copy}>
          <Text variant="label" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text variant="body" style={styles.subtitle}>{subtitle}</Text>
          {hint ? <Text variant="muted">{hint}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    flex: 1,
    minHeight: 248
  },
  card: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    paddingVertical: 2
  },
  ringSlot: {
    alignItems: 'center',
    height: 112,
    justifyContent: 'center'
  },
  copy: {
    alignItems: 'center',
    gap: 5
  },
  title: {
    fontWeight: '600',
    letterSpacing: 0.2
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: '700'
  }
});
