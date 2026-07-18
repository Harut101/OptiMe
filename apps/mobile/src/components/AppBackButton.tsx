import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';

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
      <Svg aria-hidden height={48} viewBox="0 0 48 48" width={48}>
        <Path d="M29 14 19 24l10 10" fill="none" stroke={colors.textPrimary} strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} />
      </Svg>
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
