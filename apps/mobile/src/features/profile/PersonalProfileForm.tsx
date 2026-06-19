import { StyleSheet, View } from 'react-native';
import type { ActivityLevel, PregnancyStatus } from '@optime/shared-types';

import { Field } from '@/components/Field';
import { SelectChips } from '@/components/SelectChips';
import { Text } from '@/components/Text';
import type { ProfileRequest, ProfileResponse } from '@/types/api';

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
      <Field label="First name" value={value.firstName} onChangeText={(text) => update('firstName', text)} />
      <Field label="Last name" value={value.lastName} onChangeText={(text) => update('lastName', text)} />
      <Field
        label="Date of birth"
        placeholder="YYYY-MM-DD"
        value={value.dateOfBirth}
        onChangeText={(text) => update('dateOfBirth', text)}
      />
      <Field
        label="Height (cm)"
        keyboardType="numeric"
        value={value.heightCm}
        onChangeText={(text) => update('heightCm', text)}
      />
      <Field
        label="Weight (kg)"
        keyboardType="numeric"
        value={value.weightKg}
        onChangeText={(text) => update('weightKg', text)}
      />
      <SelectChips label="Gender" value={value.gender} onChange={setGender} options={GENDER_OPTIONS} />
      <SelectChips
        label="Activity level"
        value={value.activityLevel}
        onChange={(activityLevel) => update('activityLevel', activityLevel)}
        options={ACTIVITY_OPTIONS}
      />
      {value.gender === 'female' ? (
        <View style={styles.healthContext}>
          <Text variant="label">Optional health context</Text>
          <Text variant="heading">Pregnancy / postpartum context</Text>
          <Text variant="muted">Optional. Used only to keep nutrition and training guidance safer.</Text>
          <SelectChips
            label="Choose what fits today"
            value={value.pregnancyStatus}
            onChange={(pregnancyStatus) => update('pregnancyStatus', pregnancyStatus)}
            options={PREGNANCY_OPTIONS}
          />
        </View>
      ) : null}
    </View>
  );
}

const GENDER_OPTIONS = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' }
];

const ACTIVITY_OPTIONS: Array<{ label: string; value: ActivityLevel }> = [
  { label: 'Low', value: 'LOW' },
  { label: 'Light', value: 'LIGHT' },
  { label: 'Moderate', value: 'MODERATE' },
  { label: 'High', value: 'HIGH' },
  { label: 'Athlete', value: 'ATHLETE' }
];

const PREGNANCY_OPTIONS: Array<{ label: string; value: PregnancyStatus }> = [
  { label: 'Prefer not to say', value: 'PREFER_NOT_TO_SAY' },
  { label: 'Not pregnant', value: 'NOT_PREGNANT' },
  { label: 'Pregnant', value: 'PREGNANT' },
  { label: 'Postpartum', value: 'POSTPARTUM' },
  { label: 'Breastfeeding', value: 'BREASTFEEDING' }
];

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
  healthContext: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: '#f3f7f5' }
});
