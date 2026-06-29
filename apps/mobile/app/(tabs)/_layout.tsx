import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme/colors';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.health,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surfaceElevated, borderTopColor: colors.divider },
        headerStyle: { backgroundColor: colors.surfaceElevated },
        headerTitleStyle: { fontWeight: '700', color: colors.textPrimary }
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t('tabs.today'),
          tabBarAccessibilityLabel: t('tabs.today'),
          tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: t('tabs.food'),
          tabBarAccessibilityLabel: t('tabs.food'),
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: t('tabs.training'),
          tabBarAccessibilityLabel: t('tabs.training'),
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />
        }}
      />
    </Tabs>
  );
}
