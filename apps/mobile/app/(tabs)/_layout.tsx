import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          alignItems: 'center',
          height: 62,
          justifyContent: 'center',
          margin: 0,
          padding: 0
        },
        tabBarIconStyle: {
          alignItems: 'center',
          height: 62,
          justifyContent: 'center',
          margin: 0
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 32,
          bottom: Math.max(insets.bottom, 12),
          height: 64,
          left: 16,
          paddingHorizontal: 6,
          paddingBottom: 0,
          paddingTop: 0,
          position: 'absolute',
          right: 16
        }
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t('tabs.today'),
          tabBarAccessibilityLabel: t('tabs.today'),
          tabBarIcon: ({ color, focused }) => <Ionicons name="sunny-outline" color={color} size={focused ? 30 : 26} />
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: t('tabs.food'),
          tabBarAccessibilityLabel: t('tabs.food'),
          tabBarIcon: ({ color, focused }) => <Ionicons name="restaurant-outline" color={color} size={focused ? 30 : 26} />
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: t('tabs.training'),
          tabBarAccessibilityLabel: t('tabs.training'),
          tabBarIcon: ({ color, focused }) => <Ionicons name="barbell-outline" color={color} size={focused ? 30 : 26} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => <Ionicons name="person-outline" color={color} size={focused ? 30 : 26} />
        }}
      />
    </Tabs>
  );
}
