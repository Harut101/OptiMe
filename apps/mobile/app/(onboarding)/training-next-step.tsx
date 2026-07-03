import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

export default function TrainingNextStepScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
      <Text variant="heading">{t('onboarding.trainingEnabledTitle')}</Text>
      <Text variant="muted">{t('onboarding.trainingEnabledMessage')}</Text>
      <Card>
        <Text variant="label">{t('onboarding.trainingOptionalTitle')}</Text>
        <Text variant="body">{t('onboarding.trainingOptionalMessage')}</Text>
        <Button
          title={t('onboarding.setUpWeeklyRoutine')}
          accessibilityLabel={t('onboarding.setUpWeeklyRoutine')}
          onPress={() => router.replace('/(tabs)/training')}
        />
        <Button
          title={t('onboarding.skipTrainingSetup')}
          variant="secondary"
          accessibilityLabel={t('onboarding.skipTrainingSetup')}
          onPress={() => router.replace('/(tabs)/today')}
        />
      </Card>
      <Text variant="muted">{t('onboarding.configureTrainingAnytime')}</Text>
    </Screen>
  );
}
