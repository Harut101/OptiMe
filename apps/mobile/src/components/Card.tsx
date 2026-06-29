import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2
  }
});
