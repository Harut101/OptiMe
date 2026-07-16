import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { OnboardingStepShell } from '@/features/onboarding/OnboardingStepShell';

export default function TrainingNextStepScreen() {
  const { t } = useTranslation();

  return (
    <Screen topSafeArea={false}>
      <OnboardingStepShell
        eyebrow={t('onboarding.trainingOptionalTitle')}
        title={t('onboarding.trainingEnabledTitle')}
        subtitle={t('onboarding.trainingEnabledMessage')}
        progressLabel={t('onboarding.progressComplete')}
        progressValue={1}
        primaryLabel={t('onboarding.setUpWeeklyRoutine')}
        onPrimary={() => router.replace('/(tabs)/training')}
        secondaryLabel={t('onboarding.skipTrainingSetup')}
        onSecondary={() => router.replace('/(tabs)/today')}
      >
        <Text variant="body">{t('onboarding.trainingOptionalMessage')}</Text>
        <Text variant="muted">{t('onboarding.configureTrainingAnytime')}</Text>
      </OnboardingStepShell>
    </Screen>
  );
}
