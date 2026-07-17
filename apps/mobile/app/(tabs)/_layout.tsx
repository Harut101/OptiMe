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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2
        },
        tabBarItemStyle: {
          paddingVertical: 6
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceElevated,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          height: 82,
          paddingBottom: 18,
          paddingTop: 8,
          shadowColor: colors.textPrimary,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.06,
          shadowRadius: 20,
          elevation: 10
        }
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
