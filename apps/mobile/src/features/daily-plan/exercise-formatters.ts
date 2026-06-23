import type { TFunction } from 'i18next';
import type { DailyPlanExercise, SupportedLocale } from '@optime/shared-types';

export function formatExercisePrescription(
  exercise: DailyPlanExercise,
  t: TFunction,
  locale: SupportedLocale
) {
  const sets = exercise.sets && /^\d+$/.test(exercise.sets)
    ? t('plan.setCount' as never, { count: Number(exercise.sets) })
    : exercise.sets ? t('plan.sets', { value: exercise.sets }) : null;
  return [
    sets,
    exercise.reps ? t('plan.reps', { value: exercise.reps }) : null,
    exercise.duration ? t('plan.duration', { value: formatTimedValue(exercise.duration, locale) }) : null,
    exercise.rest ? t('plan.rest', { value: formatTimedValue(exercise.rest, locale) }) : null
  ].filter(Boolean).join(' · ');
}

function formatTimedValue(value: string, locale: SupportedLocale) {
  const match = value.trim().match(/^(\d+)(?:-(\d+))?\s+(seconds?|minutes?)$/i);
  if (!match) return value;
  const unit = match[3].toLowerCase().startsWith('second') ? 'second' : 'minute';
  const format = (number: number) => new Intl.NumberFormat(locale, {
    style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 0
  }).format(number);
  return match[2] ? `${format(Number(match[1]))}–${format(Number(match[2]))}` : format(Number(match[1]));
}
