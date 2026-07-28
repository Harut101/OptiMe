import { Card } from './Card';
import { Text } from './Text';
import { Button } from './Button';

interface StateBlockProps {
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
  actionLoading?: boolean;
}

export function StateBlock({
  title,
  message,
  actionTitle,
  onAction,
  actionLoading = false
}: StateBlockProps) {
  return (
    <Card>
      <Text variant="heading">{title}</Text>
      <Text variant="muted">{message}</Text>
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          loading={actionLoading}
          onPress={onAction}
        />
      ) : null}
    </Card>
  );
}
