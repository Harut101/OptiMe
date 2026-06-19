import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

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
  const queryClient = useQueryClient();
  const [value, setValue] = useState(EMPTY_FOOD_PREFERENCES);
  const mutation = useMutation({
    mutationFn: saveNutritionPreferences,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.push('/(onboarding)/training-schedule');
    },
    onError: (error) => Alert.alert('Preferences were not saved', error.message)
  });

  const continueOnboarding = () => {
    if (!hasAllergySafetyAnswer(value)) {
      Alert.alert(
        'Allergy information needed',
        'Add any food allergies or confirm that you have no known food allergies so we can keep your plan safer.'
      );
      return;
    }

    mutation.mutate(toNutritionPreferencesRequest(value));
  };

  return (
    <Screen>
      <Text variant="heading">Food preferences</Text>
      <Text variant="muted">
        Allergy information keeps your first plan safer. The rest can be refined later from Food.
      </Text>
      <FoodPreferencesForm value={value} onChange={setValue} validationMode="onboarding" />
      <Button
        title={mutation.isPending ? 'Saving...' : 'Continue'}
        disabled={mutation.isPending}
        onPress={continueOnboarding}
      />
    </Screen>
  );
}
