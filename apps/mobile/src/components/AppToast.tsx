import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react-native';

import { colors } from '@/theme/colors';
import { Text } from './Text';

interface AppToastProps {
  title: string;
  message?: string | null;
  tone?: 'success' | 'info' | 'warning' | 'danger';
  onDismiss?: () => void;
}

export function AppToast({ title, message, tone = 'info', onDismiss }: AppToastProps) {
  const insets = useSafeAreaInsets();
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' || tone === 'danger' ? TriangleAlert : Info;
  const toneStyle = toneStyles[tone];

  useEffect(() => {
    if (!onDismiss) return;
    const timeout = setTimeout(onDismiss, 3200);
    return () => clearTimeout(timeout);
  }, [onDismiss, title, message]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View pointerEvents="box-none" style={[styles.root, { paddingTop: Math.max(insets.top + 10, 18) }]}>
        <Pressable
          accessibilityRole={onDismiss ? 'button' : 'text'}
          accessibilityLabel={[title, message].filter(Boolean).join('. ')}
          onPress={onDismiss}
          style={[styles.toast, toneStyle.container]}
        >
          <View style={[styles.iconWrap, toneStyle.iconWrap]}>
            <Icon size={17} color={toneStyle.iconColor} strokeWidth={2.6} />
          </View>
          <View style={styles.copy}>
            <Text variant="body" style={styles.title}>{title}</Text>
            {message ? <Text variant="caption">{message}</Text> : null}
          </View>
        </Pressable>
      </View>
    </Modal>
  );
}

const toneStyles = {
  success: {
    container: { borderColor: 'rgba(103, 206, 103, 0.35)' },
    iconWrap: { backgroundColor: colors.nutritionMuted },
    iconColor: colors.success
  },
  info: {
    container: { borderColor: 'rgba(129, 207, 250, 0.38)' },
    iconWrap: { backgroundColor: colors.infoMuted },
    iconColor: colors.info
  },
  warning: {
    container: { borderColor: 'rgba(241, 163, 59, 0.42)' },
    iconWrap: { backgroundColor: colors.warningMuted },
    iconColor: colors.warning
  },
  danger: {
    container: { borderColor: 'rgba(235, 75, 98, 0.38)' },
    iconWrap: { backgroundColor: colors.dangerMuted },
    iconColor: colors.danger
  }
} as const;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 18
  },
  toast: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    maxWidth: 640,
    width: '100%'
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 15,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  copy: {
    flex: 1,
    gap: 2
  },
  title: {
    fontWeight: '800'
  }
});
