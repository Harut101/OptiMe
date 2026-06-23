import { useQuery } from '@tanstack/react-query';
import { resolveSupportedLocale } from '@optime/shared-types';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { getTodayPlan } from '@/api/daily-plans';
import { getExerciseDetail } from '@/api/exercises';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { ExerciseMediaCarousel } from '@/features/daily-plan/ExerciseMediaCarousel';
import { formatExercisePrescription } from '@/features/daily-plan/exercise-formatters';
import {
  getExerciseCategoryLabel,
  getExerciseEquipmentLabel,
  getMovementPatternLabel,
  getMuscleGroupLabel
} from '@/i18n/enum-labels';
import { colors } from '@/theme/colors';

export default function ExerciseDetailsScreen() {
  const { t, i18n } = useTranslation();
  const { planId, exerciseId } = useLocalSearchParams<{ planId?: string; exerciseId?: string }>();
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const today = useQuery({ queryKey: ['today-plan'], queryFn: getTodayPlan });
  const exercise = today.data && today.data.id === planId
    ? today.data.plan.training.exercises?.find((item) => item.exerciseId === exerciseId)
    : undefined;
  const detail = useQuery({
    queryKey: ['exercise-detail', locale, exerciseId],
    queryFn: () => getExerciseDetail(exerciseId!),
    enabled: Boolean(exerciseId && exercise?.exerciseSnapshot),
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  if (today.isLoading) return <StateBlock title={t('plan.loading')} message={t('plan.loadingMessage')} />;
  if (!exercise?.exerciseSnapshot) {
    return <Screen><StateBlock title={t('plan.exerciseUnavailable')} message={t('plan.exerciseUnavailableMessage')} /></Screen>;
  }

  const snapshot = exercise.exerciseSnapshot;
  const targets = snapshot.targetMuscles.map((item) => getMuscleGroupLabel(t, item));
  const secondary = snapshot.secondaryMuscles.map((item) => getMuscleGroupLabel(t, item));
  const equipment = snapshot.equipment.map((item) => getExerciseEquipmentLabel(t, item));

  return (
    <Screen>
      {detail.isLoading ? (
        <View style={styles.mediaLoading} accessibilityLabel={t('plan.imageLoading')}>
          <Text variant="muted">{t('plan.imageLoading')}</Text>
        </View>
      ) : detail.isError ? (
        <View style={styles.mediaLoading}>
          <Text variant="muted">{t('plan.imageUnavailable')}</Text>
          <Button title={t('common.retry')} variant="secondary" onPress={() => detail.refetch()} />
        </View>
      ) : <ExerciseMediaCarousel media={detail.data?.media ?? []} t={t} />}

      <Text variant="heading">{exercise.name}</Text>
      <Text variant="muted">
        {getExerciseCategoryLabel(t, snapshot.category)} · {getMovementPatternLabel(t, snapshot.movementPattern)}
      </Text>

      <Card>
        <Text variant="label">{t('plan.targetMuscles')}</Text>
        <Text variant="body">{targets.join(' · ')}</Text>
        {secondary.length ? <Text variant="muted">{t('plan.secondaryMuscles')}: {secondary.join(' · ')}</Text> : null}
        <Text variant="label">{t('plan.equipmentLabel')}</Text>
        <Text variant="body">{equipment.join(' · ') || t('plan.noEquipment')}</Text>
      </Card>

      <Card>
        <Text variant="label">{t('plan.planPrescription')}</Text>
        <Text variant="body">{formatExercisePrescription(exercise, t, locale) || t('plan.prescriptionUnavailable')}</Text>
        {exercise.notes ? <Text variant="muted">{exercise.notes}</Text> : null}
        {exercise.intensityCue ? <Text variant="muted">{exercise.intensityCue}</Text> : null}
      </Card>

      {detail.data?.description ? (
        <Card><Text variant="label">{t('plan.aboutExercise')}</Text><Text variant="body">{detail.data.description}</Text></Card>
      ) : null}
      <ListSection title={t('plan.instructions')} items={snapshot.instructions} />
      <ListSection title={t('plan.coachingCues')} items={snapshot.coachingCues} />
      <ListSection title={t('plan.safetyNotes')} items={snapshot.safetyNotes} subtle />
    </Screen>
  );
}

function ListSection({ title, items, subtle = false }: { title: string; items: string[]; subtle?: boolean }) {
  if (!items.length) return null;
  return (
    <Card>
      <Text variant="label">{title}</Text>
      {items.map((item, index) => <Text key={`${index}-${item}`} variant={subtle ? 'muted' : 'body'}>{index + 1}. {item}</Text>)}
    </Card>
  );
}

const styles = StyleSheet.create({
  mediaLoading: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24
  }
});
