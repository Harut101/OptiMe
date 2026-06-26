import { PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function Screen({ children, scroll = true, refreshing = false, onRefresh }: ScreenProps) {
  const content = <View style={styles.content}>{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
          refreshControl={onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface
  },
  scroll: {
    flexGrow: 1
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 20,
    gap: 16
  }
});
