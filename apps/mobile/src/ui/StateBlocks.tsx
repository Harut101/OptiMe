import { StyleSheet, View } from 'react-native';

import { AppIcon, AppIconName } from './AppIcon';
import { AppText } from './AppText';
import { UIButton } from './Button';
import { UICard } from './Card';
import { lightTheme } from './theme';

export function EmptyState({ title, message, actionTitle, onAction, icon = 'info' }: {
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
  icon?: AppIconName;
}) {
  return <StateCard icon={icon} title={title} message={message} actionTitle={actionTitle} onAction={onAction} />;
}

export function ErrorState({ title, message, actionTitle, onAction }: {
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  return <StateCard icon="safety" title={title} message={message} actionTitle={actionTitle} onAction={onAction} />;
}

function StateCard({ icon, title, message, actionTitle, onAction }: {
  icon: AppIconName;
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  return (
    <UICard style={styles.card}>
      <View style={styles.iconWrap}><AppIcon name={icon} color={lightTheme.colors.brand} /></View>
      <AppText variant="heading">{title}</AppText>
      <AppText variant="muted">{message}</AppText>
      {actionTitle && onAction ? <UIButton title={actionTitle} onPress={onAction} /> : null}
    </UICard>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'flex-start' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: lightTheme.colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
