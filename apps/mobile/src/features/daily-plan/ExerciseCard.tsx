import { Ionicons } from '@expo/vector-icons';
import type { DailyPlanExercise, ExerciseListItem, SupportedLocale } from '@optime/shared-types';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { TFunction } from 'i18next';

import { Text } from '@/components/Text';
import { colors } from '@/theme/colors';
import { getExerciseEquipmentLabel, getMuscleGroupLabel } from '@/i18n/enum-labels';
import { getExerciseMediaDisplayUrl, getExerciseMediaFallbackUrl } from './exercise-media-url';
import { formatExercisePrescription } from './exercise-formatters';

interface ExerciseCardProps {
  exercise: DailyPlanExercise;
  summary?: ExerciseListItem;
  locale: SupportedLocale;
  t: TFunction;
  onPress?: () => void;
}

export function ExerciseCard({ exercise, summary, locale, t, onPress }: ExerciseCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const sourceUrl = summary?.thumbnail?.url ?? null;
  const [imageUrl, setImageUrl] = useState<string | null>(
    sourceUrl ? getExerciseMediaDisplayUrl(sourceUrl) : null
  );

  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
    setImageUrl(sourceUrl ? getExerciseMediaDisplayUrl(sourceUrl) : null);
  }, [sourceUrl]);
  const targets = (exercise.exerciseSnapshot?.targetMuscles ?? exercise.targetMuscles ?? [])
    .map((value) => getMuscleGroupLabel(t, value as never));
  const equipment = (exercise.exerciseSnapshot?.equipment ?? exercise.equipment ?? [])
    .map((value) => getExerciseEquipmentLabel(t, value as never));
  const prescription = formatExercisePrescription(exercise, t, locale);
  const label = [exercise.name, prescription, onPress ? t('plan.openExerciseDetails') : null]
    .filter(Boolean).join('. ');

  const content = (
    <>
      <View style={styles.thumbnail}>
        {!summary?.thumbnail || imageFailed || !imageLoaded ? (
          <Ionicons name="barbell-outline" size={28} color={colors.primary} accessible={false} />
        ) : null}
        {imageUrl && !imageFailed ? (
          <Image
            source={{ uri: imageUrl }}
            resizeMode="contain"
            style={[styles.image, !imageLoaded && styles.imageLoading]}
            accessible={false}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              const fallbackUrl = sourceUrl ? getExerciseMediaFallbackUrl(imageUrl, sourceUrl) : null;
              if (fallbackUrl && fallbackUrl !== imageUrl) {
                setImageLoaded(false);
                setImageUrl(fallbackUrl);
                return;
              }
              setImageFailed(true);
            }}
          />
        ) : null}
      </View>
      <View style={styles.content}>
        <Text variant="body" style={styles.name}>{exercise.name}</Text>
        {prescription ? <Text variant="body">{prescription}</Text> : null}
        {targets.length ? <Text variant="muted">{targets.join(' · ')}</Text> : null}
        {equipment.length ? <Text variant="muted">{equipment.join(' · ')}</Text> : null}
        {exercise.notes ? <Text variant="muted">{exercise.notes}</Text> : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={colors.muted} accessible={false} /> : null}
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card
  },
  pressed: { opacity: 0.78 },
  thumbnail: {
    width: 72,
    height: 88,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  imageLoading: { opacity: 0 },
  content: { flex: 1, gap: 4 },
  name: { fontWeight: '700' }
});
