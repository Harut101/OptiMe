import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
      <View pointerEvents="none" style={styles.chevron}>
        <View style={[styles.chevronArm, styles.chevronArmTop]} />
        <View style={[styles.chevronArm, styles.chevronArmBottom]} />
      </View>
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
  },
  chevron: {
    height: 24,
    left: 12,
    position: 'absolute',
    top: 12,
    width: 24
  },
  chevronArm: {
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
    height: 3.5,
    left: 5,
    position: 'absolute',
    width: 15
  },
  chevronArmTop: {
    top: 5,
    transform: [{ rotate: '-45deg' }]
  },
  chevronArmBottom: {
    top: 15.5,
    transform: [{ rotate: '45deg' }]
  }
});
