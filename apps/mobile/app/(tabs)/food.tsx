import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  getNutritionPreferences,
  saveNutritionPreferences
} from '@/api/nutrition-preferences';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import {
  EMPTY_FOOD_PREFERENCES,
  FoodPreferencesForm,
  FoodPreferencesFormValue,
  fromNutritionPreferencesResponse,
  hasAllergySafetyAnswer,
  toNutritionPreferencesRequest
} from '@/features/food-preferences/FoodPreferencesForm';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { colors } from '@/theme/colors';
import { isDraftDirty } from '@/features/editor/draft-state';
import { getDietTypeLabel } from '@/i18n/enum-labels';

export default function FoodScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const preferences = useQuery({
    queryKey: ['nutrition-preferences'],
    queryFn: getNutritionPreferences
  });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<FoodPreferencesFormValue>(EMPTY_FOOD_PREFERENCES);
  const [savedValue, setSavedValue] = useState<FoodPreferencesFormValue>(EMPTY_FOOD_PREFERENCES);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (preferences.data) {
      const next = fromNutritionPreferencesResponse(preferences.data);
      setValue(next);
      setSavedValue(next);
    }
  }, [preferences.data]);

  const dirty = isDraftDirty(value, savedValue);
  useUnsavedChangesGuard(editing && dirty);

  const mutation = useMutation({
    mutationFn: saveNutritionPreferences,
    onSuccess: async (data) => {
      const next = fromNutritionPreferencesResponse(data);
      setValue(next);
      setSavedValue(next);
      setEditing(false);
      setValidationError(null);
      setSuccessMessage(t('food.savedMessage'));
      queryClient.setQueryData(['nutrition-preferences'], data);
    }
  });

  if (preferences.isLoading) {
    return <Screen><StateBlock title={t('common.loading')} message={t('food.loadingMessage')} /></Screen>;
  }

  if (preferences.isError) {
    return (
      <Screen>
        <StateBlock title={t('food.unavailable')} message={t('errors.unableLoad')} actionTitle={t('common.retry')} onAction={() => preferences.refetch()} />
      </Screen>
    );
  }

  const startSetup = () => {
    setValue(EMPTY_FOOD_PREFERENCES);
    setSavedValue(EMPTY_FOOD_PREFERENCES);
    setSuccessMessage(null);
    setEditing(true);
  };

  const save = () => {
    if (!hasAllergySafetyAnswer(value)) {
      setValidationError(t('food.allergyRequired'));
      return;
    }
    setValidationError(null);
    mutation.mutate(toNutritionPreferencesRequest(value));
  };

  return (
    <Screen>
      <Text variant="heading">{t('food.title')}</Text>
      <Text variant="muted">{t('food.intro')}</Text>

      {!preferences.data && !editing ? (
        <StateBlock
          title={t('food.emptyTitle')}
          message={t('food.emptyMessage')}
          actionTitle={t('food.setup')}
          onAction={startSetup}
        />
      ) : editing ? (
        <>
          <FoodPreferencesForm value={value} onChange={setValue} />
          {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
          {mutation.isError ? <Text style={styles.error}>{mutation.error.message}</Text> : null}
          <View style={styles.actions}>
            <Button title={mutation.isPending ? t('common.saving') : t('common.save')} disabled={mutation.isPending || !dirty} onPress={save} />
            <Button
              title={t('common.cancel')}
              variant="secondary"
              disabled={mutation.isPending}
              onPress={() => {
                setValue(savedValue);
                setValidationError(null);
                setEditing(false);
              }}
            />
          </View>
        </>
      ) : (
        <>
          <FoodSummary value={savedValue} />
          <Button title={t('common.edit')} variant="secondary" onPress={() => { setSuccessMessage(null); setEditing(true); }} />
        </>
      )}

      {successMessage ? <Card><Text variant="label">{t('common.saved')}</Text><Text variant="muted">{successMessage}</Text></Card> : null}
    </Screen>
  );
}

function FoodSummary({ value }: { value: FoodPreferencesFormValue }) {
  const { t } = useTranslation();
  return (
    <Card>
      <Text variant="label">{t('food.current')}</Text>
      <Text>{t('food.dietStyle')}: {getDietTypeLabel(t, value.dietType)}</Text>
      <Text>{t('food.mealsPerDay')}: {value.mealsPerDay}</Text>
      <Text variant="muted">{t('food.allergies')}: {value.allergies || t('food.confirmedNoAllergies')}</Text>
      <Text variant="muted">{t('food.excludedFoods')}: {value.excludedFoods || t('common.noneAdded')}</Text>
      <Text variant="muted">{t('food.preferredFoods')}: {value.preferredFoods || t('common.noneAdded')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' }
});
