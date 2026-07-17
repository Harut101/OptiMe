import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { themeColorsByMode, type ThemeColors, type ThemeMode } from '@/theme/colors';
import { useTheme } from '@/theme/theme-provider';
import { Text } from './Text';

type HealthMetricWidgetTone =
  | 'activity'
  | 'nutrition'
  | 'training'
  | 'recovery'
  | 'sleep'
  | 'health'
  | 'weight'
  | 'neutral';

interface HealthMetricWidgetProps {
  label: string;
  context: string;
  value: string | number | null;
  unit?: string;
  comparisonLabel?: string;
  comparisonValue?: string;
  progressPercent?: number | null;
  miniBars?: number[] | null;
  tone?: HealthMetricWidgetTone;
  appearance?: ThemeMode;
  icon?: ReactNode | ((accentColor: string) => ReactNode);
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function HealthMetricWidget({
  label,
  context,
  value,
  unit,
  comparisonLabel,
  comparisonValue,
  progressPercent,
  miniBars,
  tone = 'health',
  appearance,
  icon,
  onPress,
  accessibilityLabel
}: HealthMetricWidgetProps) {
  const { colors: runtimeColors, mode } = useTheme();
  const displayValue = value === null ? '-' : String(value);
  const palette = appearance ? getPaletteForAppearance(runtimeColors, mode, appearance) : runtimeColors;
  const accent = getAccentByTone(palette)[tone];
  const isDark = appearance ? appearance === 'dark' : mode === 'dark';
  const renderedIcon = typeof icon === 'function' ? icon(accent) : icon;
  const cardStyle = [
    styles.card,
    {
      backgroundColor: palette.card,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : palette.border,
      shadowColor: isDark ? '#000000' : palette.textPrimary,
      shadowOpacity: isDark ? 0.2 : 0.08
    }
  ];
  const labelText = accessibilityLabel ?? [
    label,
    context,
    displayValue,
    unit,
    comparisonLabel,
    comparisonValue
  ].filter(Boolean).join('. ');

  const content = (
    <>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text variant="body" style={[styles.label, { color: accent }]}>{label}</Text>
          <Text variant="caption" style={[styles.context, { color: palette.textMuted }]}>{context}</Text>
        </View>
        {renderedIcon ? <View style={styles.icon}>{renderedIcon}</View> : <View style={[styles.dot, { backgroundColor: accent }]} />}
      </View>

      <View style={styles.valueRow}>
        <Text variant="metric" style={[styles.value, { color: palette.textPrimary }]}>{displayValue}</Text>
        {unit ? <Text variant="caption" style={[styles.unit, { color: palette.textSecondary }]}>{unit}</Text> : null}
      </View>

      {miniBars?.length ? (
        <View style={styles.miniBars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {miniBars.slice(0, 7).map((bar, index) => (
            <View
              key={`${bar}-${index}`}
              style={[
                styles.miniBar,
                {
                  backgroundColor: index === miniBars.length - 1 ? accent : palette.surfaceMuted,
                  height: Math.max(10, Math.min(38, 8 + bar * 30))
                }
              ]}
            />
          ))}
        </View>
      ) : null}

      {typeof progressPercent === 'number' ? (
        <View style={[styles.progressTrack, { backgroundColor: palette.surfaceMuted }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: accent,
                width: `${Math.max(0, Math.min(100, progressPercent))}%`
              }
            ]}
          />
        </View>
      ) : null}

      {comparisonLabel || comparisonValue ? (
        <View style={styles.comparison}>
          {comparisonLabel ? <Text variant="caption" style={[styles.comparisonLabel, { color: palette.textMuted }]}>{comparisonLabel}</Text> : null}
          {comparisonValue ? <Text variant="body" style={[styles.comparisonValue, { color: palette.textPrimary }]}>{comparisonValue}</Text> : null}
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [cardStyle, pressed ? styles.pressed : null]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={labelText}
        onPress={onPress}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={cardStyle}
      accessible
      accessibilityRole="text"
      accessibilityLabel={labelText}
    >
      {content}
    </View>
  );
}

function getPaletteForAppearance(runtimeColors: ThemeColors, runtimeMode: ThemeMode, appearance: ThemeMode) {
  return appearance === runtimeMode ? runtimeColors : themeColorsByMode[appearance];
}

function getAccentByTone(palette: ThemeColors) {
  return {
    activity: palette.accent,
    nutrition: palette.nutrition,
    training: palette.training,
    recovery: palette.recovery,
    sleep: palette.info,
    health: palette.health,
    weight: palette.training,
    neutral: palette.textSecondary
  } as const;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    flexGrow: 1,
    gap: 13,
    minHeight: 152,
    minWidth: '47%',
    overflow: 'hidden',
    padding: 16,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 24,
    elevation: 4
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }]
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  titleWrap: {
    flex: 1,
    gap: 1
  },
  label: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19
  },
  context: {
    fontWeight: '600'
  },
  icon: {
    alignItems: 'center',
    minHeight: 22,
    justifyContent: 'center'
  },
  dot: {
    borderRadius: 999,
    height: 10,
    marginTop: 4,
    width: 10
  },
  valueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5
  },
  value: {
    fontSize: 34,
    lineHeight: 38
  },
  unit: {
    fontSize: 13,
    fontWeight: '800',
    paddingBottom: 5
  },
  comparison: {
    gap: 1,
    marginTop: 'auto'
  },
  comparisonLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  comparisonValue: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 19
  },
  miniBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 5,
    height: 40
  },
  miniBar: {
    borderRadius: 4,
    flex: 1,
    minWidth: 5
  },
  progressTrack: {
    borderRadius: 999,
    height: 6,
    overflow: 'hidden'
  },
  progressFill: {
    borderRadius: 999,
    height: '100%'
  }
});
