import { StyleSheet, View } from 'react-native';
import type { Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackButton } from './AppBackButton';
import { Text } from './Text';
import { useTheme } from '@/theme/theme-provider';

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  fallbackHref?: Href;
}

export function AppHeader({ title, showBack = true, fallbackHref }: AppHeaderProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.row}>
        <View style={styles.side}>
          {showBack ? <AppBackButton fallbackHref={fallbackHref} /> : null}
        </View>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.side} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  side: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40
  },
  title: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center'
  }
});
