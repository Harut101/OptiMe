import { StyleSheet, View } from 'react-native';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react-native';

import { Button } from './Button';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';
import { useTheme } from '@/theme/theme-provider';

interface FeedbackAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

interface AppFeedbackSheetProps {
  visible: boolean;
  title: string;
  message: string;
  tone?: 'info' | 'warning' | 'danger' | 'success';
  actions: FeedbackAction[];
  onClose: () => void;
}

export function AppFeedbackSheet({
  visible,
  title,
  message,
  tone = 'info',
  actions,
  onClose
}: AppFeedbackSheetProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : TriangleAlert;
  const iconColor = tone === 'success'
    ? colors.success
    : tone === 'danger'
      ? colors.danger
      : tone === 'warning'
        ? colors.warning
        : colors.info;
  const iconBackground = tone === 'success'
    ? colors.successMuted
    : tone === 'danger'
      ? colors.dangerMuted
      : tone === 'warning'
        ? colors.warningMuted
        : colors.infoMuted;

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.messageRow} accessible accessibilityLabel={`${title}. ${message}`}>
        <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
          <Icon size={20} color={iconColor} strokeWidth={2.4} />
        </View>
        <Text variant="body" style={styles.message}>{message}</Text>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Button
            key={action.label}
            title={action.label}
            variant={action.variant ?? 'primary'}
            disabled={action.disabled}
            loading={action.loading}
            accessibilityLabel={action.label}
            onPress={action.onPress}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  messageRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  message: {
    color: colors.textSecondary,
    flex: 1,
    paddingTop: 7
  },
  actions: {
    gap: 10
  }
});
