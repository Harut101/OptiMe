import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { goalSchema } from '@optime/shared-schemas';
import { z } from 'zod';

import { saveGoal } from '@/api/goals';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import { getFriendlyGoalErrorMessage } from '@/features/safety/safety-copy';

type GoalForm = z.input<typeof goalSchema>;

export default function GoalSetupScreen() {
  const queryClient = useQueryClient();
  const form = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      goalType: 'IMPROVE_FITNESS'
    }
  });
  const goalType = form.watch('goalType');

  const mutation = useMutation({
    mutationFn: saveGoal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.push('/(onboarding)/nutrition-preferences');
    },
    onError: (error) =>
      Alert.alert('Let’s keep this goal safe', getFriendlyGoalErrorMessage(error))
  });

  return (
    <Screen>
      <Text variant="heading">Choose your direction</Text>
      <Text variant="muted">Pick the outcome that best matches the season you are in.</Text>

      <Controller
        control={form.control}
        name="goalType"
        render={({ field }) => (
          <SelectChips
            label="Goal"
            value={field.value}
            onChange={field.onChange}
            options={[
              { label: 'Healthy lifestyle', value: 'HEALTHY_LIFESTYLE' },
              { label: 'Improve fitness', value: 'IMPROVE_FITNESS' },
              { label: 'Build muscle', value: 'BUILD_MUSCLE' },
              { label: 'Endurance', value: 'IMPROVE_ENDURANCE' },
              { label: 'Reduce weight safely', value: 'REDUCE_WEIGHT' }
            ]}
          />
        )}
      />

      {goalType === 'REDUCE_WEIGHT' ? (
        <>
          <Controller
            control={form.control}
            name="targetWeightKg"
            render={({ field, fieldState }) => (
              <Field
                label="Target weight (kg)"
                keyboardType="numeric"
                value={field.value ? String(field.value) : ''}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="targetTimelineDays"
            render={({ field, fieldState }) => (
              <Field
                label="Timeline (days)"
                keyboardType="numeric"
                value={field.value ? String(field.value) : ''}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="impactMode"
            render={({ field }) => (
              <SelectChips
                label="Adjust through"
                value={field.value ?? 'NUTRITION_AND_TRAINING'}
                onChange={field.onChange}
                options={[
                  { label: 'Nutrition only', value: 'NUTRITION_ONLY' },
                  { label: 'Nutrition + training', value: 'NUTRITION_AND_TRAINING' }
                ]}
              />
            )}
          />
        </>
      ) : null}

      <Button
        title={mutation.isPending ? 'Saving...' : 'Continue'}
        disabled={mutation.isPending}
        onPress={form.handleSubmit((values) => mutation.mutate(values as z.output<typeof goalSchema>))}
      />
    </Screen>
  );
}
