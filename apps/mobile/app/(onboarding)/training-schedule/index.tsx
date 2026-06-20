import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Href, router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  deleteTrainingScheduleItem,
  getTrainingSchedule,
  updateTrainingIntent
} from '@/api/training-schedule';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';
import { getIntensityLabel, getSportTypeLabel } from '@/i18n/enum-labels';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const TRAINING_PREFERENCES_ROUTE = '/(onboarding)/training-preferences' as Href;

export default function TrainingScheduleScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const schedule = useQuery({
    queryKey: ['training-schedule'],
    queryFn: getTrainingSchedule
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTrainingScheduleItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-schedule'] }),
    onError: () => Alert.alert(t('schedule.deleteFailed'), t('errors.unableSave'))
  });
  const intentMutation = useMutation({
    mutationFn: updateTrainingIntent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.replace('/(tabs)/today');
    },
    onError: () => Alert.alert(t('errors.unableSave'), t('errors.network'))
  });

  if (schedule.isLoading) {
    return <StateBlock title={t('schedule.loading')} message={t('schedule.loadingMessage')} />;
  }

  if (schedule.isError) {
    return (
      <Screen>
        <StateBlock
          title={t('schedule.unavailable')}
          message={t('errors.unableLoad')}
          actionTitle={t('common.retry')}
          onAction={() => schedule.refetch()}
        />
      </Screen>
    );
  }

  const items = schedule.data ?? [];

  return (
    <Screen>
      <Text variant="heading">{t('schedule.title')}</Text>
      <Text variant="muted">{t('schedule.intro')}</Text>

      {items.length === 0 ? (
        <StateBlock
          title={t('schedule.noWorkouts')}
          message={t('schedule.noWorkoutsMessage')}
          actionTitle={t('schedule.addWorkout')}
          onAction={() => router.push('/(onboarding)/training-schedule/create')}
        />
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Text variant="label">
                  {t(`enums.weekdays.${DAY_KEYS[item.dayOfWeek]}` as never)} {t('common.at')} {item.localTime}
                </Text>
                <Text variant="body">
                  {getSportTypeLabel(t, item.sportType)} - {item.durationMinutes} {t('common.minutesShort')} -{' '}
                  {getIntensityLabel(t, item.intensity)}
                </Text>
                {item.description ? <Text variant="muted">{item.description}</Text> : null}
              </View>
            </View>
            <View style={styles.actions}>
              <Button
                title={t('common.edit')}
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/(onboarding)/training-schedule/edit',
                    params: {
                      id: item.id,
                      dayOfWeek: String(item.dayOfWeek),
                      localTime: item.localTime,
                      sportType: item.sportType,
                      durationMinutes: String(item.durationMinutes),
                      intensity: item.intensity,
                      description: item.description ?? ''
                    }
                  })
                }
              />
              <Button title={t('common.delete')} variant="danger" onPress={() => deleteMutation.mutate(item.id)} />
            </View>
          </Card>
        ))
      )}

      <Button
        title={t('schedule.addWorkout')}
        variant="secondary"
        onPress={() => router.push('/(onboarding)/training-schedule/create')}
      />
      <Button
        title={t('schedule.personalize')}
        variant="secondary"
        onPress={() => router.push(TRAINING_PREFERENCES_ROUTE)}
      />
      {items.length === 0 ? (
        <Card>
          <Text variant="label">{t('schedule.noTraining')}</Text>
          <Text variant="muted">{t('schedule.noTrainingHelp')}</Text>
          <Button
            title={intentMutation.isPending ? t('common.saving') : t('schedule.noTraining')}
            variant="secondary"
            disabled={intentMutation.isPending}
            onPress={() => intentMutation.mutate({ noTrainingPlanned: true })}
          />
        </Card>
      ) : null}
      <Button
        title={t('onboarding.continueToday')}
        disabled={items.length === 0}
        onPress={async () => {
          await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
          router.replace('/(tabs)/today');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12
  },
  grow: {
    flex: 1,
    gap: 4
  },
  actions: {
    flexDirection: 'row',
    gap: 10
  }
});
