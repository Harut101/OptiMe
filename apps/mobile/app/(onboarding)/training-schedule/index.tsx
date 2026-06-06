import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

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

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TrainingScheduleScreen() {
  const queryClient = useQueryClient();
  const schedule = useQuery({
    queryKey: ['training-schedule'],
    queryFn: getTrainingSchedule
  });
  const deleteMutation = useMutation({
    mutationFn: deleteTrainingScheduleItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-schedule'] }),
    onError: (error) => Alert.alert('Could not delete workout', error.message)
  });
  const intentMutation = useMutation({
    mutationFn: updateTrainingIntent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      router.replace('/(tabs)/today');
    },
    onError: (error) => Alert.alert('Training intent was not saved', error.message)
  });

  if (schedule.isLoading) {
    return <StateBlock title="Loading schedule" message="Checking your weekly training setup." />;
  }

  if (schedule.isError) {
    return (
      <Screen>
        <StateBlock
          title="Schedule unavailable"
          message={schedule.error.message}
          actionTitle="Try again"
          onAction={() => schedule.refetch()}
        />
      </Screen>
    );
  }

  const items = schedule.data ?? [];

  return (
    <Screen>
      <Text variant="heading">Training schedule</Text>
      <Text variant="muted">
        Add a planned session if you have one, or choose a light, safe starting point for today.
      </Text>

      {items.length === 0 ? (
        <StateBlock
          title="No workouts yet"
          message="Add at least one planned session, or choose no training planned yet."
          actionTitle="Add workout"
          onAction={() => router.push('/(onboarding)/training-schedule/create')}
        />
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Text variant="label">
                  {days[item.dayOfWeek]} at {item.localTime}
                </Text>
                <Text variant="body">
                  {item.sportType.replace('_', ' ')} - {item.durationMinutes} min -{' '}
                  {item.intensity.toLowerCase()}
                </Text>
                {item.description ? <Text variant="muted">{item.description}</Text> : null}
              </View>
            </View>
            <View style={styles.actions}>
              <Button
                title="Edit"
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
              <Button title="Delete" variant="danger" onPress={() => deleteMutation.mutate(item.id)} />
            </View>
          </Card>
        ))
      )}

      <Button
        title="Add workout"
        variant="secondary"
        onPress={() => router.push('/(onboarding)/training-schedule/create')}
      />
      {items.length === 0 ? (
        <Card>
          <Text variant="label">No training planned yet</Text>
          <Text variant="muted">We'll keep today's training guidance light and safe.</Text>
          <Button
            title={intentMutation.isPending ? 'Saving...' : 'No training planned yet'}
            variant="secondary"
            disabled={intentMutation.isPending}
            onPress={() => intentMutation.mutate({ noTrainingPlanned: true })}
          />
        </Card>
      ) : null}
      <Button
        title="Continue to Today"
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
