import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { Card } from './Card';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

interface ProviderConnectionCardProps {
  icon: ReactNode;
  name: string;
  statusLabel: string;
  statusTone?: 'neutral' | 'success' | 'warning' | 'danger';
  description: string;
  helper?: string;
  lastSync?: string | null;
  children?: ReactNode;
}

export function ProviderConnectionCard({
  icon,
  name,
  statusLabel,
  statusTone = 'neutral',
  description,
  helper,
  lastSync,
  children
}: ProviderConnectionCardProps) {
  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.iconWrap}>{icon}</View>
          <View style={styles.copy}>
            <Text variant="body" style={styles.name}>{name}</Text>
            <Text variant="caption" numberOfLines={2}>{description}</Text>
          </View>
        </View>
        <StatusPill label={statusLabel} tone={statusTone} />
      </View>
      {helper ? <Text variant="caption">{helper}</Text> : null}
      {lastSync ? <Text variant="caption" style={styles.sync}>{lastSync}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.healthMuted,
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48
  },
  copy: {
    flex: 1,
    gap: 2
  },
  name: {
    fontWeight: '800'
  },
  sync: {
    color: colors.textPrimary,
    fontWeight: '700'
  },
  actions: {
    gap: 10
  }
});
