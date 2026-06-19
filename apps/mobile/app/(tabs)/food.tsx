import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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

export default function FoodScreen() {
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
      setSuccessMessage('Your updated preferences will be used for future plans.');
      queryClient.setQueryData(['nutrition-preferences'], data);
    }
  });

  if (preferences.isLoading) {
    return <Screen><StateBlock title="Loading food preferences" message="Bringing your saved choices into view." /></Screen>;
  }

  if (preferences.isError) {
    return (
      <Screen>
        <StateBlock title="Food preferences unavailable" message={preferences.error.message} actionTitle="Try again" onAction={() => preferences.refetch()} />
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
      setValidationError('Add allergies or confirm that you have no known food allergies.');
      return;
    }
    setValidationError(null);
    mutation.mutate(toNutritionPreferencesRequest(value));
  };

  return (
    <Screen>
      <Text variant="heading">Food</Text>
      <Text variant="muted">Shape future meal guidance around foods that work for you.</Text>

      {!preferences.data && !editing ? (
        <StateBlock
          title="Personalize your meals"
          message="Add your dietary preferences and foods you want to avoid to improve future meal recommendations."
          actionTitle="Set up food preferences"
          onAction={startSetup}
        />
      ) : editing ? (
        <>
          <FoodPreferencesForm value={value} onChange={setValue} />
          {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
          {mutation.isError ? <Text style={styles.error}>{mutation.error.message}</Text> : null}
          <View style={styles.actions}>
            <Button title={mutation.isPending ? 'Saving...' : 'Save'} disabled={mutation.isPending || !dirty} onPress={save} />
            <Button
              title="Cancel"
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
          <Button title="Edit food preferences" variant="secondary" onPress={() => { setSuccessMessage(null); setEditing(true); }} />
        </>
      )}

      {successMessage ? <Card><Text variant="label">Saved</Text><Text variant="muted">{successMessage}</Text></Card> : null}
    </Screen>
  );
}

function FoodSummary({ value }: { value: FoodPreferencesFormValue }) {
  return (
    <Card>
      <Text variant="label">Current preferences</Text>
      <Text>Diet style: {humanize(value.dietType)}</Text>
      <Text>Meals per day: {value.mealsPerDay}</Text>
      <Text variant="muted">Allergies: {value.allergies || 'No known allergies confirmed'}</Text>
      <Text variant="muted">Excluded foods: {value.excludedFoods || 'None added'}</Text>
      <Text variant="muted">Preferred foods: {value.preferredFoods || 'None added'}</Text>
    </Card>
  );
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  actions: { gap: 10 },
  error: { color: colors.danger, fontWeight: '600' }
});
