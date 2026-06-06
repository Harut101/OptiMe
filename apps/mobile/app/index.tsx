import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { getMe } from '@/api/auth';
import { getOnboardingStatus } from '@/api/onboarding';
import { StateBlock } from '@/components/StateBlock';
import { useAuthStore } from '@/store/auth-store';

function firstOnboardingRoute(status: Awaited<ReturnType<typeof getOnboardingStatus>>) {
  if (status.canGenerateFirstPlan ?? status.canGeneratePlan) return '/(tabs)/today';

  const missing = status.missingStage1Fields ?? [];

  if (
    missing.some((field) =>
      ['privacyConsent', 'firstName', 'gender', 'dateOfBirth', 'heightCm', 'weightKg', 'activityLevel'].includes(field)
    )
  ) {
    return '/(onboarding)/profile';
  }

  if (
    missing.some((field) =>
      ['goalType', 'targetWeightKg', 'targetTimelineDays', 'impactMode'].includes(field)
    )
  ) {
    return '/(onboarding)/goal';
  }

  if (missing.includes('allergyInformation')) return '/(onboarding)/nutrition-preferences';
  if (missing.includes('basicTrainingIntent')) return '/(onboarding)/training-schedule';

  if (!status.profileCompleted || !status.privacyConsentCompleted) return '/(onboarding)/profile';
  if (!status.goalCompleted) return '/(onboarding)/goal';
  if (!status.nutritionPreferencesCompleted) return '/(onboarding)/nutrition-preferences';
  if (!status.trainingScheduleCompleted) return '/(onboarding)/training-schedule';
  return '/(tabs)/today';
}

export default function IndexScreen() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.accessToken);
  const setUser = useAuthStore((state) => state.setUser);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: hydrated && Boolean(token)
  });

  const onboarding = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: getOnboardingStatus,
    enabled: hydrated && Boolean(token) && me.isSuccess
  });

  useEffect(() => {
    if (me.data) {
      setUser(me.data);
    }
  }, [me.data, setUser]);

  if (!hydrated) {
    return <StateBlock title="Getting things ready" message="Checking your session." />;
  }

  if (!token) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (me.isError) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!onboarding.data) {
    return <StateBlock title="Loading your setup" message="We are preparing your next step." />;
  }

  return <Redirect href={firstOnboardingRoute(onboarding.data)} />;
}
