import { StyleSheet, View, ViewStyle } from 'react-native';

import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
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
  nutrition: ['#7EF7D4', '#2FE6C3', '#00D1A5', '#B9FF6A'],
  training: ['#6C7CFF', '#8B5CF6', '#D000D9', '#FF2D55'],
  rest: ['#B8CCFF', '#8FAEFF']
} as const;

const ringTracks = {
  nutrition: '#D9FFF4',
  training: '#E4ECFF',
  rest: '#E4ECFF'
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
  const isRestLikeState = value === null && centerLabel && centerLabel !== '-';
  const ringTone = isRestLikeState ? 'rest' : tone;

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
            trackColor={ringTracks[ringTone]}
            trackOpacity={0.92}
            endCapColor={dashboardRingGradients[ringTone][dashboardRingGradients[ringTone].length - 1]}
            emptyArcValue={isRestLikeState ? 18 : 0}
            accessibilityLabel={accessibilityLabel}
          />
        </View>
        <View style={styles.copy}>
          <Text variant="label" style={styles.title}>{title}</Text>
          <Text variant="body" style={styles.subtitle}>{subtitle}</Text>
          {hint ? <Text variant="muted">{hint}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    flex: 1
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
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  subtitle: {
    textAlign: 'center',
    fontWeight: '700'
  }
});
