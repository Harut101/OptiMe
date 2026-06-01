import { useQuery } from '@tanstack/react-query';

import { getTodayPlan } from '@/api/daily-plans';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StateBlock } from '@/components/StateBlock';
import { Text } from '@/components/Text';

export default function PlanDetailsScreen() {
  const today = useQuery({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan
  });

  if (today.isLoading) {
    return <StateBlock title="Loading plan" message="Opening your plan details." />;
  }

  const plan = today.data?.plan.plan;

  if (!plan) {
    return (
      <Screen>
        <StateBlock title="No plan yet" message="Generate a plan from Today to see details here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="heading">Plan details</Text>
      <Text variant="muted">{plan.summary}</Text>

      <Card>
        <Text variant="label">Meals</Text>
        {plan.meals.map((meal) => (
          <Text key={`${meal.mealName}-${meal.timing}`} variant="body">
            {meal.mealName}: {meal.foods.map((food) => `${food.portion} ${food.name}`).join(', ')}
          </Text>
        ))}
      </Card>

      <Card>
        <Text variant="label">Hydration</Text>
        <Text variant="body">{plan.hydration.targetLiters} liters</Text>
        <Text variant="muted">{plan.hydration.timingNotes}</Text>
      </Card>

      <Card>
        <Text variant="label">Recovery actions</Text>
        {plan.recoveryRecommendation.actions.map((action) => (
          <Text key={action} variant="body">
            {action}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}
