import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

type FloatingTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const styles = createStyles(colors);
  const width = Math.min(screenWidth - 32, 608);
  const left = (screenWidth - width) / 2;

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          bottom: Math.max(insets.bottom - 8, 8),
          left,
          width
        }
      ]}
    >
      {state.routes.map((route, index) => {
        const options = descriptors[route.key].options;
        const focused = state.index === index;
        const color = focused ? colors.textPrimary : colors.textMuted;

        const onPress = () => {
          const event = navigation.emit({
            canPreventDefault: true,
            target: route.key,
            type: 'tabPress'
          });

          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            accessibilityLabel={options.tabBarAccessibilityLabel}
            accessibilityRole="tab"
            accessibilityState={focused ? { selected: true } : {}}
            key={route.key}
            onLongPress={() => navigation.emit({ target: route.key, type: 'tabLongPress' })}
            onPress={onPress}
            style={({ pressed }) => [styles.item, pressed ? styles.pressed : null]}
          >
            <View style={styles.icon}>
              {options.tabBarIcon?.({ color, focused, size: focused ? 28 : 24 })}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    flexDirection: 'row',
    height: 60,
    paddingHorizontal: 6,
    position: 'absolute'
  },
  item: {
    alignItems: 'center',
    flex: 1,
    height: 58,
    justifyContent: 'center'
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -2 }]
  },
  pressed: {
    opacity: 0.7
  }
});
