import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useTheme } from '@/theme/theme-provider';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background, paddingBottom: 68 },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false
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
