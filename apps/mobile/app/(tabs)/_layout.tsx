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
        tabBarActiveTintColor: colors.health,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: colors.surfaceMuted,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          borderRadius: 28,
          marginHorizontal: 3,
          paddingVertical: 4
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderRadius: 34,
          height: 68,
          marginBottom: 10,
          marginHorizontal: 16,
          paddingHorizontal: 6,
          paddingVertical: 6,
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
          tabBarIcon: ({ color }) => <Ionicons name="sunny-outline" color={color} size={27} />
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: t('tabs.food'),
          tabBarAccessibilityLabel: t('tabs.food'),
          tabBarIcon: ({ color }) => <Ionicons name="restaurant-outline" color={color} size={27} />
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: t('tabs.training'),
          tabBarAccessibilityLabel: t('tabs.training'),
          tabBarIcon: ({ color }) => <Ionicons name="barbell-outline" color={color} size={27} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" color={color} size={27} />
        }}
      />
    </Tabs>
  );
}
