import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme/colors';
import { Text } from '@/components/Text';

interface CircularProgressRingProps {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  gradientColors: readonly string[];
  trackColor?: string;
  trackOpacity?: number;
  endCapColor?: string;
  emptyArcValue?: number;
  showEndCapDot?: boolean;
  accessibilityLabel?: string;
}

export function CircularProgressRing({
  value,
  size = 108,
  strokeWidth = 16,
  label,
  gradientColors,
  trackColor = colors.divider,
  trackOpacity = 1,
  endCapColor,
  emptyArcValue = 0,
  showEndCapDot = true,
  accessibilityLabel
}: CircularProgressRingProps) {
  const rawGradientId = useId();
  const gradientId = `ring-${rawGradientId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedValue = value === null ? Math.max(0, Math.min(100, emptyArcValue)) : Math.max(0, Math.min(100, value));
  const center = size / 2;
  const segmentCount = 36;
  const activeSegmentCount = Math.ceil((normalizedValue / 100) * segmentCount);
  const segmentArc = circumference / segmentCount;
  const segmentGap = Math.min(2.4, segmentArc * 0.24);
  const visibleSegmentArc = Math.max(segmentArc - segmentGap, 0.5);
  const capColor = endCapColor ?? gradientColors[gradientColors.length - 1] ?? colors.primary;
  const capPosition = getEndCapPosition(center, radius, normalizedValue);
  const shouldRenderSegmentedArc = normalizedValue > 0 && activeSegmentCount > 0;
  const shouldRenderEndCapDot = value !== null && showEndCapDot && normalizedValue > 2 && normalizedValue < 99.5;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityValue={value === null ? undefined : { min: 0, max: 100, now: Math.round(normalizedValue) }}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {gradientColors.map((color, index) => (
              <Stop
                key={`${color}-${index}`}
                offset={`${gradientColors.length === 1 ? 100 : (index / (gradientColors.length - 1)) * 100}%`}
                stopColor={color}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          opacity={trackOpacity}
          fill="transparent"
        />
        {shouldRenderSegmentedArc ? (
          Array.from({ length: activeSegmentCount }).map((_, index) => (
            <Circle
              key={`segment-${index}`}
              cx={center}
              cy={center}
              r={radius}
              stroke={interpolateGradientColor(gradientColors, index / (segmentCount - 1))}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={`${visibleSegmentArc} ${circumference}`}
              strokeDashoffset={-index * segmentArc}
              strokeLinecap="round"
              rotation="-90"
              origin={`${center}, ${center}`}
            />
          ))
        ) : null}
        {!shouldRenderSegmentedArc && value !== null ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={`0 ${circumference}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${center}, ${center}`}
          />
        ) : null}
        {shouldRenderEndCapDot ? (
          <>
            <Circle
              cx={capPosition.x}
              cy={capPosition.y}
              r={strokeWidth * 0.43}
              fill={colors.surfaceElevated}
            />
            <Circle
              cx={capPosition.x}
              cy={capPosition.y}
              r={strokeWidth * 0.28}
              fill={capColor}
            />
          </>
        ) : null}
      </Svg>
      <View style={styles.labelWrap} pointerEvents="none">
        <Text variant="heading" style={styles.label}>
          {label ?? (value === null ? '-' : `${Math.round(normalizedValue)}%`)}
        </Text>
      </View>
    </View>
  );
}

function getEndCapPosition(center: number, radius: number, value: number) {
  const angle = (value / 100) * 2 * Math.PI - Math.PI / 2;

  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle)
  };
}

function interpolateGradientColor(colorsToInterpolate: readonly string[], ratio: number) {
  if (colorsToInterpolate.length === 0) return colors.primary;
  if (colorsToInterpolate.length === 1) return colorsToInterpolate[0];

  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const scaled = clampedRatio * (colorsToInterpolate.length - 1);
  const startIndex = Math.floor(scaled);
  const endIndex = Math.min(startIndex + 1, colorsToInterpolate.length - 1);
  const localRatio = scaled - startIndex;
  const start = hexToRgb(colorsToInterpolate[startIndex]);
  const end = hexToRgb(colorsToInterpolate[endIndex]);

  return rgbToHex({
    r: Math.round(start.r + (end.r - start.r) * localRatio),
    g: Math.round(start.g + (end.g - start.g) * localRatio),
    b: Math.round(start.b + (end.b - start.b) * localRatio)
  });
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  svg: {
    position: 'absolute'
  },
  labelWrap: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    color: colors.textPrimary
  }
});
