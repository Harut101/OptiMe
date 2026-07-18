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
    backgroundColor: 'transparent',
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    margin: 0,
    maxHeight: 44,
    maxWidth: 40,
    minHeight: 44,
    minWidth: 40,
    padding: 0,
    width: 40
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }]
  },
  chevron: {
    height: 20,
    position: 'relative',
    width: 20
  },
  chevronArm: {
    backgroundColor: colors.textPrimary,
    borderRadius: 1.5,
    height: 2.5,
    left: 4,
    position: 'absolute',
    width: 12
  },
  chevronArmTop: {
    top: 4.75,
    transform: [{ rotate: '-45deg' }]
  },
  chevronArmBottom: {
    top: 12.75,
    transform: [{ rotate: '45deg' }]
  }
});
