import { Card } from './Card';
import { Text } from './Text';
import { Button } from './Button';

interface StateBlockProps {
  title: string;
  message: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function StateBlock({ title, message, actionTitle, onAction }: StateBlockProps) {
  return (
    <Card>
      <Text variant="heading">{title}</Text>
      <Text variant="muted">{message}</Text>
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} /> : null}
    </Card>
  );
}
