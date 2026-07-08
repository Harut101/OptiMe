import { PropsWithChildren } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { colors } from '@/theme/colors';
import { Text } from './Text';

interface BottomSheetProps extends PropsWithChildren {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export function BottomSheet({ visible, title, subtitle, onClose, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.backdrop}
          onPress={onClose}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text variant="heading">{title}</Text>
              {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={styles.closeButton} onPress={onClose}>
              <X size={19} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.38)'
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '82%',
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 12
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: colors.divider,
    borderRadius: 999,
    height: 5,
    marginBottom: 14,
    width: 42
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between'
  },
  titleWrap: {
    flex: 1,
    gap: 4
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  content: {
    gap: 14,
    paddingTop: 18
  }
});
