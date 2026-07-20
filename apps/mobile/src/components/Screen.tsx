import { PropsWithChildren, ReactNode, useRef } from 'react';
import { Animated, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  topSafeArea?: boolean;
  topBackdrop?: ReactNode;
}

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  topSafeArea = true,
  topBackdrop
}: ScreenProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const scrollY = useRef(new Animated.Value(0)).current;
  const backdropTranslateY = scrollY.interpolate({
    inputRange: [0, 360],
    outputRange: [0, -360],
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });
  const content = <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView
      edges={topSafeArea ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}
      style={styles.safeArea}
    >
      {topBackdrop ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.topBackdrop, { transform: [{ translateY: backdropTranslateY }] }]}
        >
          {topBackdrop}
        </Animated.View>
      ) : null}
      {scroll ? (
        <Animated.ScrollView
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          onScroll={topBackdrop ? Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: Platform.OS !== 'web' }
          ) : undefined}
          scrollEventThrottle={topBackdrop ? 16 : undefined}
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
        </Animated.ScrollView>
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
  topBackdrop: {
    height: 360,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0
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
