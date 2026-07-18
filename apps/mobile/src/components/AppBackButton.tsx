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
      <ChevronLeft color={colors.textPrimary} size={28} strokeWidth={3} />
    </Pressable>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }]
  }
});
