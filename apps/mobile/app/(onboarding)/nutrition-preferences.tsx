import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getGoal } from '@/api/goals';
import { saveNutritionPreferences } from '@/api/nutrition-preferences';
import { AppFeedbackSheet } from '@/components/AppFeedbackSheet';
import { Screen } from '@/components/Screen';
import {
  EMPTY_FOOD_PREFERENCES,
  FoodPreferencesForm,
  hasAllergySafetyAnswer,
  toNutritionPreferencesRequest
} from '@/features/food-preferences/FoodPreferencesForm';
import { OnboardingStepShell } from '@/features/onboarding/OnboardingStepShell';

export default function NutritionPreferencesOnboardingStep() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(EMPTY_FOOD_PREFERENCES);
  const [errorSheet, setErrorSheet] = useState<{ title: string; message: string } | null>(null);
  const mutation = useMutation({
    mutationFn: saveNutritionPreferences,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      try {
        const goal = await queryClient.ensureQueryData({ queryKey: ['goal'], queryFn: getGoal });
        const appMode = goal?.appMode ?? goal?.impactMode;
        const nextRoute = appMode === 'NUTRITION_AND_TRAINING'
          ? ('/(onboarding)/training-next-step' as Href)
          : ('/(tabs)/today' as Href);
        router.replace(nextRoute);
      } catch {
        router.replace('/(tabs)/today');
      }
    },
    onError: () => setErrorSheet({ title: t('onboarding.preferencesNotSaved'), message: t('errors.unableSave') })
  });

  const continueOnboarding = () => {
    if (!hasAllergySafetyAnswer(value)) {
      setErrorSheet({
        title: t('onboarding.allergyNeededTitle'),
        message: t('onboarding.allergyNeededMessage')
      });
      return;
    }

    mutation.mutate(toNutritionPreferencesRequest(value));
  };

  return (
    <Screen topSafeArea={false}>
      <OnboardingStepShell
        eyebrow={t('onboarding.stepFood')}
        title={t('onboarding.foodTitle')}
        subtitle={t('onboarding.foodMessage')}
        progressLabel={t('onboarding.progressFood')}
        progressValue={1}
        primaryLabel={mutation.isPending ? t('common.saving') : t('common.continue')}
        primaryLoading={mutation.isPending}
        onPrimary={continueOnboarding}
        secondaryLabel={t('common.back')}
        onSecondary={() => router.back()}
      >
        <FoodPreferencesForm value={value} onChange={setValue} validationMode="onboarding" />
      </OnboardingStepShell>
      <AppFeedbackSheet
        visible={errorSheet !== null}
        title={errorSheet?.title ?? t('onboarding.preferencesNotSaved')}
        message={errorSheet?.message ?? t('errors.unableSave')}
        tone="warning"
        onClose={() => setErrorSheet(null)}
        actions={[{ label: t('common.close'), variant: 'secondary', onPress: () => setErrorSheet(null) }]}
      />
    </Screen>
  );
}
