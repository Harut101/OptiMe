import { StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { useTheme } from '@/theme/theme-provider';

export function AppLaunchSplash() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BrandLogo width={224} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24
  }
});
