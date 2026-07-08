import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Moon,
  RefreshCw,
  ShieldAlert
} from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';

type Tone = 'training' | 'recovery' | 'success' | 'warning' | 'neutral';

const toneColor = (tone: Tone) => {
  if (tone === 'recovery') return colors.recovery;
  if (tone === 'success') return colors.success;
  if (tone === 'warning') return colors.warning;
  if (tone === 'neutral') return colors.textMuted;
  return colors.training;
};

const toneMutedColor = (tone: Tone) => {
  if (tone === 'recovery') return colors.recoveryMuted;
  if (tone === 'success') return colors.successMuted;
  if (tone === 'warning') return colors.warningMuted;
  if (tone === 'neutral') return colors.cardMuted;
  return colors.trainingMuted;
};

export function TrainingMetricWidget({
  label,
  value,
  helper,
  tone = 'training'
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: Tone;
}) {
  return (
    <View style={[styles.metricWidget, { backgroundColor: toneMutedColor(tone) }]}>
      <Text variant="caption" style={[styles.metricLabel, { color: toneColor(tone) }]}>{label}</Text>
      <Text variant="heading" style={styles.metricValue}>{value}</Text>
      {helper ? <Text variant="caption" style={styles.metricHelper}>{helper}</Text> : null}
    </View>
  );
}

export function TrainingStatusCard({
  label,
  title,
  subtitle,
  meta,
  statusLabel,
  statusTone = 'training',
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  accessibilityLabel
}: {
  label: string;
  title: string;
  subtitle?: string;
  meta?: string;
  statusLabel: string;
  statusTone?: Tone;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  accessibilityLabel?: string;
}) {
  const Icon = statusTone === 'recovery' || statusTone === 'neutral' ? Moon : statusTone === 'success' ? CheckCircle2 : Dumbbell;
  return (
    <Card style={styles.statusCard} accessibilityLabel={accessibilityLabel}>
      <View style={styles.statusTop}>
        <View style={[styles.statusIcon, { backgroundColor: toneMutedColor(statusTone) }]}>
          <Icon size={22} color={toneColor(statusTone)} strokeWidth={2.8} />
        </View>
        <StatusPill
          label={statusLabel}
          tone={statusTone === 'recovery' ? 'recovery' : statusTone === 'warning' ? 'warning' : statusTone === 'success' ? 'success' : 'training'}
        />
      </View>
      <Text variant="caption" style={[styles.accentLabel, { color: toneColor(statusTone) }]}>{label}</Text>
      <Text variant="heading" style={styles.bigTitle}>{title}</Text>
      {subtitle ? <Text variant="body" style={styles.statusSubtitle}>{subtitle}</Text> : null}
      {meta ? <Text variant="muted">{meta}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.actionRow}>
          <Button title={actionLabel} onPress={onAction} accessibilityLabel={actionLabel} />
          {secondaryActionLabel && onSecondaryAction ? (
            <Button title={secondaryActionLabel} variant="secondary" onPress={onSecondaryAction} accessibilityLabel={secondaryActionLabel} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

export function TrainingLoadInsightCard({
  title,
  status,
  message,
  bullets = [],
  tone = 'training',
  onPress
}: {
  title: string;
  status: string;
  message: string;
  bullets?: string[];
  tone?: Tone;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.compactHeader}>
        <View style={[styles.smallIcon, { backgroundColor: toneMutedColor(tone) }]}>
          <HeartPulse size={18} color={toneColor(tone)} strokeWidth={2.7} />
        </View>
        <View style={styles.flex}>
          <Text variant="caption" style={[styles.accentLabel, { color: toneColor(tone) }]}>{title}</Text>
          <Text variant="heading" style={styles.cardTitle}>{status}</Text>
        </View>
        {onPress ? <ChevronRight size={19} color={colors.textMuted} /> : null}
      </View>
      <Text variant="body">{message}</Text>
      {bullets.slice(0, 2).map((bullet) => (
        <Text key={bullet} variant="caption" style={styles.bullet}>• {bullet}</Text>
      ))}
    </>
  );

  if (!onPress) return <Card style={styles.compactCard}>{content}</Card>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${status}. ${message}`}
      onPress={onPress}
      style={({ pressed }) => [styles.pressableCard, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

export function WeeklyRoutinePreviewCard({
  title,
  subtitle,
  days,
  onDayPress
}: {
  title: string;
  subtitle: string;
  days: Array<{
    key: string;
    dayLabel: string;
    title: string;
    meta?: string;
    isTrainingDay: boolean;
    accessibilityLabel: string;
  }>;
  onDayPress: (key: string) => void;
}) {
  return (
    <Card>
      <View style={styles.compactHeader}>
        <View style={[styles.smallIcon, { backgroundColor: colors.trainingMuted }]}>
          <CalendarDays size={18} color={colors.training} strokeWidth={2.7} />
        </View>
        <View style={styles.flex}>
          <Text variant="label">{title}</Text>
          <Text variant="muted">{subtitle}</Text>
        </View>
      </View>
      <View style={styles.weekGrid}>
        {days.map((day) => (
          <Pressable
            key={day.key}
            accessibilityRole="button"
            accessibilityLabel={day.accessibilityLabel}
            onPress={() => onDayPress(day.key)}
            style={({ pressed }) => [
              styles.dayTile,
              day.isTrainingDay ? styles.dayTileTraining : styles.dayTileRest,
              pressed ? styles.pressed : null
            ]}
          >
            <Text variant="caption" style={styles.dayLabel}>{day.dayLabel}</Text>
            <Text variant="body" numberOfLines={2} style={styles.dayTitle}>{day.title}</Text>
            {day.meta ? <Text variant="caption" numberOfLines={1}>{day.meta}</Text> : null}
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

export function WorkoutActionCard({
  title,
  message,
  statusLabel,
  actionLabel,
  onAction,
  tone = 'training',
  disabled,
  errorMessage
}: {
  title: string;
  message: string;
  statusLabel: string;
  actionLabel: string;
  onAction: () => void;
  tone?: Tone;
  disabled?: boolean;
  errorMessage?: string | null;
}) {
  return (
    <Card style={styles.compactCard}>
      <View style={styles.compactHeader}>
        <View style={[styles.smallIcon, { backgroundColor: toneMutedColor(tone) }]}>
          <Activity size={18} color={toneColor(tone)} strokeWidth={2.7} />
        </View>
        <View style={styles.flex}>
          <Text variant="label">{title}</Text>
          <Text variant="muted">{message}</Text>
        </View>
        <StatusPill label={statusLabel} tone={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'training'} />
      </View>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      <Button title={actionLabel} onPress={onAction} disabled={disabled} accessibilityLabel={actionLabel} />
    </Card>
  );
}

export function WorkoutProgressHeader({
  title,
  subtitle,
  progressPercent,
  completedExercises,
  totalExercises,
  completedSets,
  totalSets,
  exercisesLabel,
  setsLabel,
  completedLabel,
  isCompleted,
  isPartial
}: {
  title: string;
  subtitle: string;
  progressPercent: number;
  completedExercises: number;
  totalExercises: number;
  completedSets: number;
  totalSets: number;
  exercisesLabel: string;
  setsLabel: string;
  completedLabel: string;
  isCompleted: boolean;
  isPartial: boolean;
}) {
  const tone: Tone = isCompleted ? 'success' : isPartial ? 'warning' : 'training';
  return (
    <Card style={styles.progressHero}>
      <View style={styles.compactHeader}>
        <View style={[styles.statusIcon, { backgroundColor: toneMutedColor(tone) }]}>
          <Dumbbell size={22} color={toneColor(tone)} strokeWidth={2.8} />
        </View>
        <StatusPill label={isCompleted ? completedLabel : `${progressPercent}%`} tone={isCompleted ? 'success' : 'training'} />
      </View>
      <Text variant="heading" style={styles.bigTitle}>{title}</Text>
      <Text variant="muted">{subtitle}</Text>
      <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progressPercent }}>
        <View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, progressPercent))}%`, backgroundColor: toneColor(tone) }]} />
      </View>
      <View style={styles.metricRow}>
        <TrainingMetricWidget label={exercisesLabel} value={`${completedExercises}/${totalExercises}`} tone={tone} />
        <TrainingMetricWidget label={setsLabel} value={`${completedSets}/${totalSets}`} tone={tone} />
      </View>
    </Card>
  );
}

export function WorkoutExerciseCardSurface({
  title,
  subtitle,
  thumbnailUrl,
  completed,
  children,
  onOpen
}: {
  title: string;
  subtitle: string;
  thumbnailUrl?: string | null;
  completed: boolean;
  children: ReactNode;
  onOpen?: () => void;
}) {
  return (
    <Card style={completed ? styles.completedExerciseCard : undefined}>
      <View style={styles.exerciseHeader}>
        <Pressable
          accessibilityRole={onOpen ? 'button' : 'image'}
          accessibilityLabel={onOpen ? title : undefined}
          disabled={!onOpen}
          onPress={onOpen}
          style={styles.thumbnail}
        >
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} resizeMode="contain" style={styles.image} accessible={false} />
          ) : (
            <Dumbbell size={28} color={colors.training} accessible={false} />
          )}
        </Pressable>
        <View style={styles.exerciseCopy}>
          <View style={styles.compactHeader}>
            <Text variant="heading" style={styles.exerciseTitle}>{title}</Text>
            {completed ? <CheckCircle2 size={18} color={colors.success} /> : null}
          </View>
          <Text variant="muted">{subtitle}</Text>
        </View>
      </View>
      {children}
    </Card>
  );
}

export function WorkoutHistoryCard({
  label,
  title,
  subtitle,
  meta,
  statusLabel,
  isPartial,
  onPress,
  accessibilityLabel
}: {
  label: string;
  title: string;
  subtitle: string;
  meta?: string;
  statusLabel: string;
  isPartial: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.pressableCard, styles.historyCard, pressed ? styles.pressed : null]}
    >
      <View style={styles.compactHeader}>
        <View style={[styles.smallIcon, { backgroundColor: isPartial ? colors.warningMuted : colors.successMuted }]}>
          <CheckCircle2 size={18} color={isPartial ? colors.warning : colors.success} strokeWidth={2.7} />
        </View>
        <Text variant="caption" style={styles.flex}>{label}</Text>
        <StatusPill label={statusLabel} tone={isPartial ? 'warning' : 'success'} />
      </View>
      <Text variant="heading" style={styles.cardTitle}>{title}</Text>
      <Text variant="body">{subtitle}</Text>
      {meta ? <Text variant="caption">{meta}</Text> : null}
    </Pressable>
  );
}

export function ReplacementProposalCard({
  original,
  replacement,
  reason,
  accessibilityLabel
}: {
  original: string;
  replacement: string;
  reason: string;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.replacementCard} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.smallIcon, { backgroundColor: colors.warningMuted }]}>
        <RefreshCw size={17} color={colors.warning} strokeWidth={2.7} />
      </View>
      <View style={styles.flex}>
        <Text variant="caption" style={styles.mutedStrong}>{original}</Text>
        <Text variant="heading" style={styles.replacementArrow}>→ {replacement}</Text>
        <Text variant="caption">{reason}</Text>
      </View>
    </View>
  );
}

export function SafetyDecisionCard({
  title,
  message,
  children
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <Card style={styles.safetyCard}>
      <View style={styles.compactHeader}>
        <View style={[styles.smallIcon, { backgroundColor: colors.warningMuted }]}>
          <ShieldAlert size={18} color={colors.warning} strokeWidth={2.7} />
        </View>
        <Text variant="label" style={styles.flex}>{title}</Text>
      </View>
      <Text variant="body">{message}</Text>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  actionRow: { gap: 10, marginTop: 4 },
  accentLabel: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
  bigTitle: { fontSize: 30, lineHeight: 34, letterSpacing: -1.1 },
  bullet: { color: colors.textSecondary },
  cardTitle: { fontSize: 22, lineHeight: 26, letterSpacing: -0.5 },
  compactCard: { gap: 12 },
  compactHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  completedExerciseCard: { borderColor: 'rgba(103, 206, 103, 0.45)' },
  dayLabel: { color: colors.textMuted, fontWeight: '900' },
  dayTile: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minHeight: 94,
    width: '48.8%',
    padding: 12
  },
  dayTileRest: { backgroundColor: colors.infoMuted, borderColor: 'rgba(129, 207, 250, 0.35)' },
  dayTileTraining: { backgroundColor: colors.trainingMuted, borderColor: 'rgba(58, 130, 247, 0.32)' },
  dayTitle: { fontWeight: '900' },
  errorText: { color: colors.danger, fontWeight: '800' },
  exerciseCopy: { flex: 1, gap: 4 },
  exerciseHeader: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  exerciseTitle: { flex: 1, fontSize: 20, lineHeight: 24 },
  flex: { flex: 1 },
  historyCard: { gap: 9 },
  image: { height: '100%', width: '100%' },
  metricHelper: { color: colors.textSecondary },
  metricLabel: { fontWeight: '900' },
  metricRow: { flexDirection: 'row', gap: 10 },
  metricValue: { fontSize: 24, lineHeight: 28 },
  metricWidget: { borderRadius: 20, flex: 1, gap: 2, padding: 14 },
  mutedStrong: { color: colors.textMuted, fontWeight: '800' },
  pressableCard: {
    backgroundColor: colors.card,
    borderColor: 'rgba(209, 209, 214, 0.65)',
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3
  },
  pressed: { opacity: 0.84, transform: [{ scale: 0.995 }] },
  progressFill: { borderRadius: 999, height: '100%' },
  progressHero: { gap: 14 },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 12,
    overflow: 'hidden'
  },
  replacementArrow: { fontSize: 20, lineHeight: 24 },
  replacementCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.cardMuted,
    borderColor: colors.divider,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12
  },
  safetyCard: { borderColor: 'rgba(241, 163, 59, 0.45)' },
  smallIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  statusCard: { gap: 12 },
  statusIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 46,
    justifyContent: 'center',
    width: 46
  },
  statusSubtitle: { fontWeight: '700' },
  statusTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  thumbnail: {
    alignItems: 'center',
    backgroundColor: colors.trainingMuted,
    borderRadius: 18,
    height: 88,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 76
  },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
});
