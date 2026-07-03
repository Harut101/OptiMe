import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getGoal } from '@/api/goals';
import { saveNutritionPreferences } from '@/api/nutrition-preferences';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import {
  EMPTY_FOOD_PREFERENCES,
  FoodPreferencesForm,
  hasAllergySafetyAnswer,
  toNutritionPreferencesRequest
} from '@/features/food-preferences/FoodPreferencesForm';

export default function NutritionPreferencesOnboardingStep() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(EMPTY_FOOD_PREFERENCES);
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
    onError: () => Alert.alert(t('onboarding.preferencesNotSaved'), t('errors.unableSave'))
  });

  const continueOnboarding = () => {
    if (!hasAllergySafetyAnswer(value)) {
      Alert.alert(
        t('onboarding.allergyNeededTitle'),
        t('onboarding.allergyNeededMessage')
      );
      return;
    }

    mutation.mutate(toNutritionPreferencesRequest(value));
  };

  return (
    <Screen>
      <Text variant="heading">{t('onboarding.foodTitle')}</Text>
      <Text variant="muted">{t('onboarding.foodMessage')}</Text>
      <FoodPreferencesForm value={value} onChange={setValue} validationMode="onboarding" />
      <Button
        title={mutation.isPending ? t('common.saving') : t('common.continue')}
        disabled={mutation.isPending}
        onPress={continueOnboarding}
      />
    </Screen>
  );
}
