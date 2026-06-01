import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';

import { saveNutritionPreferences } from '@/api/nutrition-preferences';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import type { DietType } from '@optime/shared-types';

interface NutritionForm {
  dietType: DietType;
  mealsPerDay: string;
  allergies: string;
  excludedFoods: string;
  preferredFoods: string;
  notes: string;
}

export default function NutritionPreferencesScreen() {
  const queryClient = useQueryClient();
  const form = useForm<NutritionForm>({
    defaultValues: {
      dietType: 'NONE',
      mealsPerDay: '3',
      allergies: '',
      excludedFoods: '',
      preferredFoods: '',
      notes: ''
    }
  });

  const mutation = useMutation({
    mutationFn: saveNutritionPreferences,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.push('/(onboarding)/training-schedule');
    },
    onError: (error) => Alert.alert('Preferences were not saved', error.message)
  });

  return (
    <Screen>
      <Text variant="heading">Food preferences</Text>
      <Text variant="muted">Add the foods your plan should respect from the start.</Text>

      <Controller
        control={form.control}
        name="dietType"
        render={({ field }) => (
          <SelectChips
            label="Diet style"
            value={field.value}
            onChange={field.onChange}
            options={[
              { label: 'None', value: 'NONE' },
              { label: 'Vegetarian', value: 'VEGETARIAN' },
              { label: 'Vegan', value: 'VEGAN' },
              { label: 'Mediterranean', value: 'MEDITERRANEAN' },
              { label: 'Low carb', value: 'LOW_CARB' }
            ]}
          />
        )}
      />
      <Controller
        control={form.control}
        name="mealsPerDay"
        render={({ field }) => (
          <Field label="Meals per day" keyboardType="numeric" value={field.value} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="allergies"
        render={({ field }) => (
          <Field label="Allergies" placeholder="peanuts, shellfish" value={field.value} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="excludedFoods"
        render={({ field }) => (
          <Field label="Excluded foods" placeholder="foods to avoid" value={field.value} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="preferredFoods"
        render={({ field }) => (
          <Field label="Preferred foods" placeholder="rice, eggs, berries" value={field.value} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={form.control}
        name="notes"
        render={({ field }) => (
          <Field label="Notes" multiline value={field.value} onChangeText={field.onChange} />
        )}
      />

      <Button
        title={mutation.isPending ? 'Saving...' : 'Continue'}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) =>
          mutation.mutate({
            dietType: values.dietType,
            mealsPerDay: Number(values.mealsPerDay),
            notes: values.notes || undefined,
            allergies: splitList(values.allergies),
            excludedFoods: splitList(values.excludedFoods),
            preferredFoods: splitList(values.preferredFoods)
          })
        )}
      />
    </Screen>
  );
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
