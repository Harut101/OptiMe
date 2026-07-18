import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';

import { useTheme } from '@/theme/theme-provider';

interface AppBackButtonProps {
  fallbackHref?: Href;
}

export function AppBackButton({ fallbackHref = '/(tabs)/today' }: AppBackButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityLabel={t('common.back')}
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref))}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <ChevronLeft color={colors.textPrimary} size={32} strokeWidth={3} style={styles.icon} />
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56
  },
  icon: {
    transform: [{ translateX: 1 }]
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }]
  }
});
