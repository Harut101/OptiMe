import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { saveNutritionPreferences } from '@/api/nutrition-preferences';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
import type { DietType } from '@optime/shared-types';

interface NutritionForm {
  dietType: DietType;
  mealsPerDay: string;
  noKnownAllergiesConfirmed: boolean;
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
      noKnownAllergiesConfirmed: false,
      allergies: '',
      excludedFoods: '',
      preferredFoods: '',
      notes: ''
    }
  });
  const allergiesValue = useWatch({ control: form.control, name: 'allergies' });
  const noKnownAllergiesConfirmed = useWatch({
    control: form.control,
    name: 'noKnownAllergiesConfirmed'
  });
  const enteredAllergies = splitList(allergiesValue ?? '');

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
      <Text variant="muted">Food allergies help us keep your plan safer.</Text>

      <Controller
        control={form.control}
        name="allergies"
        render={({ field }) => (
          <Field
            label="Food allergies"
            placeholder="peanuts, shellfish"
            value={field.value}
            onChangeText={(value) => {
              field.onChange(value);

              if (splitList(value).length > 0) {
                form.setValue('noKnownAllergiesConfirmed', false, { shouldDirty: true });
              }
            }}
          />
        )}
      />
      <Controller
        control={form.control}
        name="noKnownAllergiesConfirmed"
        render={({ field }) => (
          <Pressable
            onPress={() => {
              const nextValue = !field.value;
              field.onChange(nextValue);

              if (nextValue) {
                form.setValue('allergies', '', { shouldDirty: true });
              }
            }}
            style={[
              styles.toggle,
              field.value ? styles.toggleActive : null,
              enteredAllergies.length > 0 ? styles.toggleDisabled : null
            ]}
            disabled={enteredAllergies.length > 0}
          >
            <View style={[styles.checkbox, field.value ? styles.checkboxActive : null]}>
              {field.value ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <View style={styles.toggleCopy}>
              <Text variant="label">No known food allergies</Text>
              <Text variant="muted">
                Choose this if you do not know of any food allergies we should avoid.
              </Text>
            </View>
          </Pressable>
        )}
      />

      {!noKnownAllergiesConfirmed && enteredAllergies.length === 0 ? (
        <Text style={styles.warning}>
          Add any food allergies or choose no known food allergies to continue safely.
        </Text>
      ) : null}

      <View style={styles.optionalSection}>
        <Text variant="label">Optional — improve personalization later</Text>
        <Text variant="muted">
          These details can make plans feel more tailored, but they are not required for your first
          safe plan.
        </Text>
      </View>
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
        onPress={form.handleSubmit((values) => {
          const allergies = splitList(values.allergies);

          if (allergies.length === 0 && !values.noKnownAllergiesConfirmed) {
            Alert.alert(
              'Allergy information needed',
              'Add any food allergies or choose no known food allergies so we can keep your plan safer.'
            );
            return;
          }

          mutation.mutate({
            dietType: values.dietType,
            mealsPerDay: Number(values.mealsPerDay) || 3,
            noKnownAllergiesConfirmed: values.noKnownAllergiesConfirmed,
            notes: values.notes || undefined,
            allergies,
            excludedFoods: splitList(values.excludedFoods),
            preferredFoods: splitList(values.preferredFoods)
          });
        })}
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

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card
  },
  toggleActive: {
    borderColor: colors.primary,
    backgroundColor: '#e7f3ef'
  },
  toggleDisabled: {
    opacity: 0.55
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  checkboxActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  checkmark: {
    color: '#ffffff',
    fontWeight: '800'
  },
  toggleCopy: {
    flex: 1,
    gap: 4
  },
  optionalSection: {
    gap: 6,
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  warning: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600'
  }
});
