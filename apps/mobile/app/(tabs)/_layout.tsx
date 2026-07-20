import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const tabBarWidth = Math.min(screenWidth - 32, 608);
  const tabBarLeft = (screenWidth - tabBarWidth) / 2;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background, paddingBottom: 68 },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          alignItems: 'center',
          height: 58,
          justifyContent: 'center',
          margin: 0,
          padding: 0
        },
        tabBarIconStyle: {
          alignItems: 'center',
          height: 58,
          justifyContent: 'center',
          margin: 0,
          transform: [{ translateY: -2 }]
        },
        tabBarStyle: {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 30,
          bottom: Math.max(insets.bottom - 8, 8),
          height: 60,
          left: tabBarLeft,
          paddingHorizontal: 6,
          paddingBottom: 0,
          paddingTop: 0,
          position: 'absolute',
          right: 'auto',
          width: tabBarWidth
        }
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: t('tabs.today'),
          tabBarAccessibilityLabel: t('tabs.today'),
          tabBarIcon: ({ color, focused }) => <Ionicons name="sunny-outline" color={color} size={focused ? 28 : 24} />
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: t('tabs.food'),
          tabBarAccessibilityLabel: t('tabs.food'),
          tabBarIcon: ({ color, focused }) => <Ionicons name="restaurant-outline" color={color} size={focused ? 28 : 24} />
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: t('tabs.training'),
          tabBarAccessibilityLabel: t('tabs.training'),
          tabBarIcon: ({ color, focused }) => <Ionicons name="barbell-outline" color={color} size={focused ? 28 : 24} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => <Ionicons name="person-outline" color={color} size={focused ? 28 : 24} />
        }}
      />
    </Tabs>
  );
}
