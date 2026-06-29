import { StyleSheet, View } from 'react-native';
import type { ActivityLevel, PregnancyStatus } from '@optime/shared-types';
import { useTranslation } from 'react-i18next';

import { Field } from '@/components/Field';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import type { ProfileRequest, ProfileResponse } from '@/types/api';
import { enumOptions, getActivityLevelLabel, getGenderLabel, getPregnancyStatusLabel, type GenderValue } from '@/i18n/enum-labels';
import { useSettingsStore } from '@/store/settings-store';
import { colors } from '@/theme/colors';

export interface PersonalProfileFormValue {
  firstName: string;
  lastName: string;
  gender: string;
  pregnancyStatus: PregnancyStatus;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel;
}

interface PersonalProfileFormProps {
  value: PersonalProfileFormValue;
  onChange: (value: PersonalProfileFormValue) => void;
}

export const EMPTY_PERSONAL_PROFILE: PersonalProfileFormValue = {
  firstName: '',
  lastName: '',
  gender: 'prefer_not_to_say',
  pregnancyStatus: 'PREFER_NOT_TO_SAY',
  dateOfBirth: '',
  heightCm: '170',
  weightKg: '70',
  activityLevel: 'MODERATE'
};

export function PersonalProfileForm({ value, onChange }: PersonalProfileFormProps) {
  const { t } = useTranslation();
  const measurementSystem = useSettingsStore((state) => state.measurementSystem);
  const update = <K extends keyof PersonalProfileFormValue>(
    key: K,
    nextValue: PersonalProfileFormValue[K]
  ) => onChange({ ...value, [key]: nextValue });

  const setGender = (gender: string) =>
    onChange({
      ...value,
      gender,
      pregnancyStatus: gender === 'female' ? value.pregnancyStatus : 'PREFER_NOT_TO_SAY'
    });

  return (
    <View style={styles.form}>
      <Field label={t('profile.firstName')} value={value.firstName} onChangeText={(text) => update('firstName', text)} />
      <Field label={t('profile.lastName')} value={value.lastName} onChangeText={(text) => update('lastName', text)} />
      <Field
        label={t('profile.dateOfBirth')}
        placeholder={t('profile.datePlaceholder')}
        value={value.dateOfBirth}
        onChangeText={(text) => update('dateOfBirth', text)}
      />
      <Field
        label={t('profile.height', { unit: measurementSystem === 'IMPERIAL' ? 'in' : 'cm' })}
        keyboardType="numeric"
        value={toDisplayMeasurement(value.heightCm, measurementSystem, 'height')}
        onChangeText={(text) => update('heightCm', toCanonicalMeasurement(text, measurementSystem, 'height'))}
      />
      <Field
        label={t('profile.weight', { unit: measurementSystem === 'IMPERIAL' ? 'lb' : 'kg' })}
        keyboardType="numeric"
        value={toDisplayMeasurement(value.weightKg, measurementSystem, 'weight')}
        onChangeText={(text) => update('weightKg', toCanonicalMeasurement(text, measurementSystem, 'weight'))}
      />
      <SelectChips label={t('profile.gender')} value={value.gender} onChange={setGender} options={enumOptions(GENDERS, (item) => getGenderLabel(t, item))} />
      <SelectChips
        label={t('profile.activity')}
        value={value.activityLevel}
        onChange={(activityLevel) => update('activityLevel', activityLevel)}
        options={enumOptions(ACTIVITY_LEVELS, (item) => getActivityLevelLabel(t, item))}
      />
      {value.gender === 'female' ? (
        <View style={styles.healthContext}>
          <Text variant="label">{t('profile.healthContext')}</Text>
          <Text variant="heading">{t('profile.pregnancyContext')}</Text>
          <Text variant="muted">{t('profile.pregnancyHelp')}</Text>
          <SelectChips
            label={t('profile.chooseToday')}
            value={value.pregnancyStatus}
            onChange={(pregnancyStatus) => update('pregnancyStatus', pregnancyStatus)}
            options={enumOptions(PREGNANCY_STATUSES, (item) => getPregnancyStatusLabel(t, item))}
          />
        </View>
      ) : null}
    </View>
  );
}

const GENDERS: GenderValue[] = ['female', 'male', 'other', 'prefer_not_to_say'];
const ACTIVITY_LEVELS: ActivityLevel[] = ['LOW', 'LIGHT', 'MODERATE', 'HIGH', 'ATHLETE'];
const PREGNANCY_STATUSES: PregnancyStatus[] = ['PREFER_NOT_TO_SAY', 'NOT_PREGNANT', 'PREGNANT', 'POSTPARTUM', 'BREASTFEEDING'];

function toDisplayMeasurement(value: string, system: 'METRIC' | 'IMPERIAL', kind: 'height' | 'weight') {
  if (system === 'METRIC' || value === '') return value;
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return String(Number((kind === 'height' ? number / 2.54 : number * 2.2046226218).toFixed(1)));
}

function toCanonicalMeasurement(value: string, system: 'METRIC' | 'IMPERIAL', kind: 'height' | 'weight') {
  if (system === 'METRIC' || value === '') return value;
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return String(Number((kind === 'height' ? number * 2.54 : number / 2.2046226218).toFixed(4)));
}

export function fromProfileResponse(response: ProfileResponse): PersonalProfileFormValue {
  if (!response.profile) {
    return { ...EMPTY_PERSONAL_PROFILE, firstName: response.user.firstName ?? '', lastName: response.user.lastName ?? '' };
  }

  return {
    firstName: response.user.firstName ?? '',
    lastName: response.user.lastName ?? '',
    gender: response.profile.gender ?? 'prefer_not_to_say',
    pregnancyStatus: response.profile.pregnancyStatus,
    dateOfBirth: response.profile.dateOfBirth.slice(0, 10),
    heightCm: String(response.profile.heightCm),
    weightKg: String(response.profile.weightKg),
    activityLevel: response.profile.activityLevel
  };
}

export function toProfileRequest(value: PersonalProfileFormValue): ProfileRequest {
  return {
    firstName: value.firstName.trim() || undefined,
    lastName: value.lastName.trim() || undefined,
    gender: value.gender,
    pregnancyStatus: value.pregnancyStatus,
    dateOfBirth: value.dateOfBirth,
    heightCm: Number(value.heightCm),
    weightKg: Number(value.weightKg),
    activityLevel: value.activityLevel
  };
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  healthContext: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: colors.healthMuted }
});
