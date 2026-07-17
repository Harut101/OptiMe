import { PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  topSafeArea?: boolean;
}

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  topSafeArea = true
}: ScreenProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const content = <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView
      edges={topSafeArea ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}
      style={styles.safeArea}
    >
      {scroll ? (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          refreshControl={onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.health}
              colors={[colors.health]}
            />
          ) : undefined}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    flexGrow: 1
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingBottom: 24,
    paddingTop: 14,
    gap: 16
  }
});
