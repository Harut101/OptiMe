import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme/theme-provider';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: 0
        },
        tabBarIconStyle: { margin: 0 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 34,
          height: 68,
          marginBottom: 10,
          marginHorizontal: 16,
          paddingHorizontal: 6,
          paddingVertical: 5,
          shadowColor: colors.textPrimary,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 10
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
