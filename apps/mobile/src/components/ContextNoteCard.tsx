import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Card } from './Card';
import { Text } from './Text';

type ContextNoteTone = 'neutral' | 'success' | 'warning' | 'nutrition' | 'training' | 'recovery' | 'health' | 'info';

interface ContextNoteCardProps {
  title: string;
  message: string;
  tone?: ContextNoteTone;
}

export function ContextNoteCard({ title, message, tone = 'neutral' }: ContextNoteCardProps) {
  return (
    <Card>
      <View style={[styles.accent, styles[tone]]} />
      <View style={styles.content} accessible accessibilityLabel={`${title}. ${message}`}>
        <Text variant="label">{title}</Text>
        <Text variant="muted">{message}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  accent: {
    borderRadius: 999,
    height: 4,
    width: 42
  },
  content: {
    gap: 6
  },
  neutral: {
    backgroundColor: colors.divider
  },
  success: {
    backgroundColor: colors.success
  },
  warning: {
    backgroundColor: colors.warning
  },
  nutrition: {
    backgroundColor: colors.nutrition
  },
  training: {
    backgroundColor: colors.training
  },
  recovery: {
    backgroundColor: colors.recovery
  },
  health: {
    backgroundColor: colors.health
  },
  info: {
    backgroundColor: colors.info
  }
});
