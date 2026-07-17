import { Pressable, StyleSheet, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/theme-provider';
import type { ThemeColors } from '@/theme/colors';
import { Text } from './Text';

interface AIRecommendationEntryProps {
  title: string;
  summary: string;
  badge?: string;
  onPress: () => void;
}

export function AIRecommendationEntry({ title, summary, badge, onPress }: AIRecommendationEntryProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${summary}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.iconWrap}>
        <Sparkles size={18} color={colors.health} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text variant="body" style={styles.title}>{title}</Text>
          {badge ? <Text variant="caption" style={styles.badge}>{badge}</Text> : null}
        </View>
        <Text variant="caption">{summary}</Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.healthMuted,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.995 }]
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.healthMuted,
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  copy: {
    flex: 1,
    gap: 2
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  title: {
    fontWeight: '800'
  },
  badge: {
    color: colors.health,
    fontWeight: '800'
  }
});
