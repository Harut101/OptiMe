import type { ComponentType } from 'react';
import type { ColorValue } from 'react-native';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock,
  Dumbbell,
  HeartPulse,
  Home,
  Info,
  MapPin,
  Pencil,
  Plus,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  Trash2,
  UserRound,
  Utensils
} from 'lucide-react-native';

import { lightTheme } from './theme';

export type AppIconName =
  | 'today'
  | 'food'
  | 'training'
  | 'profile'
  | 'schedule'
  | 'goal'
  | 'location'
  | 'equipment'
  | 'duration'
  | 'settings'
  | 'health'
  | 'safety'
  | 'info'
  | 'edit'
  | 'delete'
  | 'back'
  | 'next'
  | 'add'
  | 'completed';

const icons: Record<AppIconName, ComponentType<{ color?: ColorValue; size?: number; strokeWidth?: number }>> = {
  today: Home,
  food: Utensils,
  training: Dumbbell,
  profile: UserRound,
  schedule: CalendarDays,
  goal: Target,
  location: MapPin,
  equipment: Dumbbell,
  duration: Clock,
  settings: SlidersHorizontal,
  health: HeartPulse,
  safety: ShieldAlert,
  info: Info,
  edit: Pencil,
  delete: Trash2,
  back: ArrowLeft,
  next: ChevronRight,
  add: Plus,
  completed: Check
};

export function AppIcon({
  name,
  color = lightTheme.colors.textSecondary,
  size = lightTheme.sizing.icon,
  strokeWidth = 2
}: {
  name: AppIconName;
  color?: ColorValue;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = icons[name] ?? CircleHelp;
  return <Icon color={color} size={size} strokeWidth={strokeWidth} />;
}
