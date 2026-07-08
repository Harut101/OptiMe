import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { BottomSheet } from './BottomSheet';
import { ContextNoteCard } from './ContextNoteCard';
import { Text } from './Text';

interface FeedbackAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
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
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <ContextNoteCard title={title} message={message} tone={tone === 'danger' ? 'warning' : tone} />
      <Text variant="muted">{message}</Text>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Button
            key={action.label}
            title={action.label}
            variant={action.variant ?? 'primary'}
            disabled={action.disabled}
            accessibilityLabel={action.label}
            onPress={action.onPress}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10
  }
});
