import { router } from 'expo-router';
import { Dumbbell, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/Screen';
import { SelectableCard } from '@/components/SelectableCard';
import { OnboardingStepShell } from '@/features/onboarding/OnboardingStepShell';
import { colors } from '@/theme/colors';

export default function TrainingNextStepScreen() {
  const { t } = useTranslation();

  return (
    <Screen>
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
        <SelectableCard
          icon={<Dumbbell size={19} color={colors.textInverse} />}
          selected
          title={t('onboarding.setUpWeeklyRoutine')}
          subtitle={t('onboarding.trainingOptionalMessage')}
          onPress={() => router.replace('/(tabs)/training')}
        />
        <SelectableCard
          icon={<Utensils size={19} color={colors.nutrition} />}
          selected={false}
          title={t('onboarding.skipTrainingSetup')}
          subtitle={t('onboarding.configureTrainingAnytime')}
          onPress={() => router.replace('/(tabs)/today')}
        />
      </OnboardingStepShell>
    </Screen>
  );
}
