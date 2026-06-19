import { Pressable, StyleSheet, View } from 'react-native';
import type { DietType } from '@optime/shared-types';

import { Field } from '@/components/Field';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
import type {
  NutritionPreferencesRequest,
  NutritionPreferencesResponse
} from '@/types/api';

export interface FoodPreferencesFormValue {
  dietType: DietType;
  mealsPerDay: string;
  noKnownAllergiesConfirmed: boolean;
  allergies: string;
  excludedFoods: string;
  preferredFoods: string;
  notes: string;
}

interface FoodPreferencesFormProps {
  value: FoodPreferencesFormValue;
  onChange: (value: FoodPreferencesFormValue) => void;
  validationMode?: 'onboarding' | 'standalone';
}

export const EMPTY_FOOD_PREFERENCES: FoodPreferencesFormValue = {
  dietType: 'NONE',
  mealsPerDay: '3',
  noKnownAllergiesConfirmed: false,
  allergies: '',
  excludedFoods: '',
  preferredFoods: '',
  notes: ''
};

export function FoodPreferencesForm({
  value,
  onChange,
  validationMode = 'standalone'
}: FoodPreferencesFormProps) {
  const enteredAllergies = splitList(value.allergies);
  const update = <K extends keyof FoodPreferencesFormValue>(
    key: K,
    nextValue: FoodPreferencesFormValue[K]
  ) => onChange({ ...value, [key]: nextValue });

  return (
    <View style={styles.form}>
      <Field
        label="Food allergies"
        placeholder="peanuts, shellfish"
        value={value.allergies}
        onChangeText={(text) =>
          onChange({
            ...value,
            allergies: text,
            noKnownAllergiesConfirmed:
              splitList(text).length > 0 ? false : value.noKnownAllergiesConfirmed
          })
        }
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value.noKnownAllergiesConfirmed }}
        onPress={() => {
          const confirmed = !value.noKnownAllergiesConfirmed;
          onChange({ ...value, noKnownAllergiesConfirmed: confirmed, allergies: confirmed ? '' : value.allergies });
        }}
        style={[
          styles.toggle,
          value.noKnownAllergiesConfirmed ? styles.toggleActive : null,
          enteredAllergies.length > 0 ? styles.toggleDisabled : null
        ]}
        disabled={enteredAllergies.length > 0}
      >
        <View style={[styles.checkbox, value.noKnownAllergiesConfirmed ? styles.checkboxActive : null]}>
          {value.noKnownAllergiesConfirmed ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <View style={styles.toggleCopy}>
          <Text variant="label">No known food allergies</Text>
          <Text variant="muted">Choose this if there are no known food allergies to avoid.</Text>
        </View>
      </Pressable>
      {validationMode === 'onboarding' && !hasAllergySafetyAnswer(value) ? (
        <Text style={styles.warning}>
          Add allergies or confirm that you have no known food allergies to continue safely.
        </Text>
      ) : null}
      <SelectChips
        label="Diet style"
        value={value.dietType}
        onChange={(next) => update('dietType', next)}
        options={DIET_OPTIONS}
      />
      <Field
        label="Meals per day"
        keyboardType="numeric"
        value={value.mealsPerDay}
        onChangeText={(text) => update('mealsPerDay', text)}
      />
      <Field
        label="Excluded foods"
        placeholder="foods you prefer to avoid"
        value={value.excludedFoods}
        onChangeText={(text) => update('excludedFoods', text)}
      />
      <Field
        label="Preferred foods"
        placeholder="rice, eggs, berries"
        value={value.preferredFoods}
        onChangeText={(text) => update('preferredFoods', text)}
      />
      <Field
        label="Food and meal notes"
        placeholder="meal timing, simple prep, or other preferences"
        multiline
        value={value.notes}
        onChangeText={(text) => update('notes', text)}
      />
    </View>
  );
}

const DIET_OPTIONS: Array<{ label: string; value: DietType }> = [
  { label: 'None', value: 'NONE' },
  { label: 'Omnivore', value: 'OMNIVORE' },
  { label: 'Vegetarian', value: 'VEGETARIAN' },
  { label: 'Vegan', value: 'VEGAN' },
  { label: 'Pescatarian', value: 'PESCATARIAN' },
  { label: 'Mediterranean', value: 'MEDITERRANEAN' },
  { label: 'Low carb', value: 'LOW_CARB' },
  { label: 'Halal', value: 'HALAL' },
  { label: 'Kosher', value: 'KOSHER' }
];

export function hasAllergySafetyAnswer(value: FoodPreferencesFormValue) {
  return value.noKnownAllergiesConfirmed || splitList(value.allergies).length > 0;
}

export function toNutritionPreferencesRequest(
  value: FoodPreferencesFormValue
): NutritionPreferencesRequest {
  return {
    dietType: value.dietType,
    mealsPerDay: Number(value.mealsPerDay) || 3,
    noKnownAllergiesConfirmed: value.noKnownAllergiesConfirmed,
    notes: value.notes.trim() || undefined,
    allergies: splitList(value.allergies),
    excludedFoods: splitList(value.excludedFoods),
    preferredFoods: splitList(value.preferredFoods)
  };
}

export function fromNutritionPreferencesResponse(
  preference: NutritionPreferencesResponse
): FoodPreferencesFormValue {
  return {
    dietType: preference.dietType,
    mealsPerDay: String(preference.mealsPerDay),
    noKnownAllergiesConfirmed: preference.noKnownAllergiesConfirmed,
    allergies: preference.allergies.map((item) => item.name).join(', '),
    excludedFoods: preference.excludedFoods.map((item) => item.name).join(', '),
    preferredFoods: preference.preferredFoods.map((item) => item.name).join(', '),
    notes: preference.notes ?? ''
  };
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  toggle: {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 8,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card
  },
  toggleActive: { borderColor: colors.primary, backgroundColor: '#e7f3ef' },
  toggleDisabled: { opacity: 0.55 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', marginTop: 2
  },
  checkboxActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkmark: { color: '#ffffff', fontWeight: '800' },
  toggleCopy: { flex: 1, gap: 4 },
  warning: { color: colors.danger, fontSize: 13, fontWeight: '600' }
});
