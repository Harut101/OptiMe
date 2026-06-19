import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontWeight: '700' }
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarAccessibilityLabel: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food',
          tabBarAccessibilityLabel: 'Food preferences',
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: 'Training',
          tabBarAccessibilityLabel: 'Training setup',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" color={color} size={size} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile and settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />
        }}
      />
    </Tabs>
  );
}
