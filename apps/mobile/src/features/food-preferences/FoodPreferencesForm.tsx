import { Pressable, StyleSheet, View } from 'react-native';
import type { DietType } from '@optime/shared-types';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/Field';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
import type {
  NutritionPreferencesRequest,
  NutritionPreferencesResponse
} from '@/types/api';
import { enumOptions, getDietTypeLabel } from '@/i18n/enum-labels';

export interface FoodPreferencesFormValue {
  dietType: DietType;
  mealsPerDay: string;
  noKnownAllergiesConfirmed: boolean;
  allergies: string;
  excludedFoods: string;
  dislikedFoods: string;
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
  dislikedFoods: '',
  preferredFoods: '',
  notes: ''
};

export function FoodPreferencesForm({
  value,
  onChange,
  validationMode = 'standalone'
}: FoodPreferencesFormProps) {
  const { t } = useTranslation();
  const enteredAllergies = splitList(value.allergies);
  const update = <K extends keyof FoodPreferencesFormValue>(
    key: K,
    nextValue: FoodPreferencesFormValue[K]
  ) => onChange({ ...value, [key]: nextValue });

  return (
    <View style={styles.form}>
      <Field
        label={t('food.allergies')}
        placeholder={t('food.allergiesPlaceholder')}
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
          <Text variant="label">{t('food.noAllergies')}</Text>
          <Text variant="muted">{t('food.noAllergiesHelp')}</Text>
        </View>
      </Pressable>
      {validationMode === 'onboarding' && !hasAllergySafetyAnswer(value) ? (
        <Text style={styles.warning}>
          {t('food.allergyRequired')}
        </Text>
      ) : null}
      <SelectChips
        label={t('food.dietStyle')}
        value={value.dietType}
        onChange={(next) => update('dietType', next)}
        options={enumOptions(DIET_VALUES, (item) => getDietTypeLabel(t, item))}
      />
      <Field
        label={t('food.mealsPerDay')}
        keyboardType="numeric"
        value={value.mealsPerDay}
        onChangeText={(text) => update('mealsPerDay', text)}
      />
      <Field
        label={t('food.excludedFoods')}
        placeholder={t('food.excludedPlaceholder')}
        value={value.excludedFoods}
        onChangeText={(text) => update('excludedFoods', text)}
      />
      <Field
        label={t('food.dislikedFoods')}
        placeholder={t('food.dislikedPlaceholder')}
        value={value.dislikedFoods}
        onChangeText={(text) => update('dislikedFoods', text)}
      />
      <Field
        label={t('food.preferredFoods')}
        placeholder={t('food.preferredPlaceholder')}
        value={value.preferredFoods}
        onChangeText={(text) => update('preferredFoods', text)}
      />
      <Field
        label={t('food.notes')}
        placeholder={t('food.notesPlaceholder')}
        multiline
        value={value.notes}
        onChangeText={(text) => update('notes', text)}
      />
    </View>
  );
}

const DIET_VALUES: DietType[] = ['NONE', 'OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'KETO', 'MEDITERRANEAN', 'LOW_CARB', 'HALAL', 'KOSHER'];

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
    dislikedFoods: splitList(value.dislikedFoods),
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
    dislikedFoods: preference.dislikedFoods.map((item) => item.name).join(', '),
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
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated
  },
  toggleActive: { borderColor: colors.nutrition, backgroundColor: colors.nutritionMuted },
  toggleDisabled: { opacity: 0.55 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 2
  },
  checkboxActive: { borderColor: colors.nutrition, backgroundColor: colors.nutrition },
  checkmark: { color: colors.textInverse, fontWeight: '800' },
  toggleCopy: { flex: 1, gap: 4 },
  warning: { color: colors.danger, fontSize: 13, fontWeight: '600' }
});
