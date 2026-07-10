import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Apple, Crown, Dumbbell, HeartPulse, Settings, Utensils } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  AppIcon,
  AppText,
  Chip,
  EmptyState,
  ErrorState,
  ProgressBar,
  UIButton,
  UICard,
  darkTheme,
  lightTheme,
  uiDarkColors,
  uiColors
} from '@/ui';
import { ContextNoteCard } from '@/components/ContextNoteCard';
import { AppToast } from '@/components/AppToast';
import { AIRecommendationEntry } from '@/components/AIRecommendationEntry';
import { AICoachBottomSheet } from '@/components/AICoachBottomSheet';
import { Button } from '@/components/Button';
import { HealthMetricWidget } from '@/components/HealthMetricWidget';
import { MetricCard } from '@/components/MetricCard';
import { MiniBarChart } from '@/components/MiniBarChart';
import { ProviderConnectionCard } from '@/components/ProviderConnectionCard';
import { SelectChips } from '@/components/SelectChips';
import { SelectableCard } from '@/components/SelectableCard';
import { SettingsListItem } from '@/components/SettingsListItem';
import { StatusPill } from '@/components/StatusPill';
import { WorkoutCardV2 } from '@/components/WorkoutCardV2';
import { CircularProgressRing } from '@/features/today-dashboard/CircularProgressRing';
import {
  DashboardProgressCard,
  dashboardRingGradients
} from '@/features/today-dashboard/DashboardProgressCard';
import { WearableSummaryCard } from '@/features/today-dashboard/WearableSummaryCard';
import {
  MacroMetricWidget,
  MealProgressWidget,
  PremiumMealCard
} from '@/features/food-dashboard/FoodDashboardWidgets';
import {
  ReplacementProposalCard,
  SafetyDecisionCard,
  TrainingLoadInsightCard,
  TrainingStatusCard,
  WeeklyRoutinePreviewCard,
  WorkoutExerciseCardSurface,
  WorkoutHistoryCard,
  WorkoutProgressHeader
} from '@/features/training-dashboard/TrainingDashboardWidgets';
import type { FoodDayLogResponse, FoodMeal, WearableSnapshotResponse } from '@/types/api';

export default function DesignSystemPreviewScreen() {
  const { t } = useTranslation();
  const [coachVisible, setCoachVisible] = useState(false);
  const [segmentPreview, setSegmentPreview] = useState<'D' | 'W' | 'M' | '6M' | 'Y'>('W');
  const lightColorEntries = Object.entries(uiColors);
  const darkColorEntries = Object.entries(uiDarkColors);
  const previewWearableSnapshot: WearableSnapshotResponse = {
    hasRecentData: true,
    messageCode: 'WEARABLE_DATA_CONNECTED',
    snapshot: {
      id: 'preview',
      userId: 'preview',
      localDate: '2026-07-02',
      timezone: 'Asia/Yerevan',
      source: 'APPLE_HEALTH',
      steps: 8420,
      activeCaloriesKcal: 410,
      workoutMinutes: 38,
      sleepMinutes: 438,
      sleepQualityScore: 82,
      recoveryScore: null,
      strainScore: null,
      restingHeartRateBpm: null,
      hrvMs: null,
      respiratoryRate: null,
      capturedAt: new Date().toISOString(),
      isStale: false
    }
  };
  const semanticEntries = [
    ['nutrition', uiColors.nutrition, uiColors.nutritionMuted],
    ['training', uiColors.training, uiColors.trainingMuted],
    ['recovery', uiColors.recovery, uiColors.recoveryMuted],
    ['health', uiColors.health, uiColors.healthMuted],
    ['success', uiColors.success, uiColors.successMuted],
    ['warning', uiColors.warning, uiColors.warningMuted],
    ['danger', uiColors.danger, uiColors.dangerMuted],
    ['info', uiColors.info, uiColors.infoMuted]
  ] as const;
  const previewMeal: FoodMeal = {
    id: 'preview-breakfast',
    mealType: 'BREAKFAST',
    title: 'Greek yogurt bowl',
    shortDescription: 'Creamy, simple, protein-forward.',
    caloriesKcal: 520,
    proteinGrams: 34,
    carbsGrams: 58,
    fatGrams: 14,
    prepTimeMinutes: 10,
    servingSummary: '1 bowl',
    ingredients: [],
    preparationSteps: [],
    substitutions: [],
    explanation: { reasonCodes: ['TARGET_ALIGNED', 'SIMPLE_PREP'] }
  };
  const previewFoodLog: FoodDayLogResponse = {
    id: 'preview-food-log',
    dailyPlanId: 'preview-plan',
    localDate: '2026-07-02',
    supported: true,
    plannedMealCount: 4,
    completedMealCount: 2,
    partialMealCount: 1,
    skippedMealCount: 0,
    markedMealCount: 3,
    mealProgress: [
      {
        id: 'preview-progress',
        mealId: 'preview-breakfast',
        mealOrder: 0,
        mealType: 'BREAKFAST',
        mealTitleSnapshot: 'Greek yogurt bowl',
        status: 'EATEN',
        updatedAt: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  };
  const iconNames = ['today', 'food', 'training', 'profile', 'schedule', 'goal', 'health', 'safety', 'settings'] as const;

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <AppText variant="title">{t('designSystem.title')}</AppText>
      <AppText variant="muted">{t('designSystem.intro')}</AppText>

      <UICard>
        <AppText variant="heading">{t('designSystem.lightTheme')}</AppText>
        <View style={styles.swatchGrid}>
          {lightColorEntries.map(([name, value]) => (
            <View key={name} style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: value }]} />
              <AppText variant="caption">{name}</AppText>
            </View>
          ))}
        </View>
      </UICard>

      <UICard style={styles.darkCard}>
        <AppText variant="heading" style={styles.darkText}>{t('designSystem.darkTheme')}</AppText>
        <View style={styles.swatchGrid}>
          {darkColorEntries.map(([name, value]) => (
            <View key={name} style={styles.swatchRow}>
              <View style={[styles.swatch, { backgroundColor: value, borderColor: darkTheme.colors.border }]} />
              <AppText variant="caption" style={styles.darkMuted}>{name}</AppText>
            </View>
          ))}
        </View>
      </UICard>

      <UICard>
        <AppText variant="heading">{t('designSystem.semanticColors')}</AppText>
        <View style={styles.semanticGrid}>
          {semanticEntries.map(([name, color, muted]) => (
            <View key={name} style={[styles.semanticCard, { backgroundColor: muted }]}>
              <View style={[styles.semanticDot, { backgroundColor: color }]} />
              <AppText variant="caption">{name}</AppText>
            </View>
          ))}
        </View>
      </UICard>

      <UICard>
        <AppText variant="heading">{t('designSystem.typography')}</AppText>
        <AppText variant="title">Title</AppText>
        <AppText variant="heading">Heading</AppText>
        <AppText>Body text for everyday guidance.</AppText>
        <AppText variant="muted">Muted supporting copy.</AppText>
        <AppText variant="label">Label</AppText>
      </UICard>

      <UICard>
        <AppText variant="heading">{t('designSystem.components')}</AppText>
        <UIButton title={t('common.save')} icon="completed" />
        <UIButton title={t('common.edit')} icon="edit" variant="secondary" />
        <Button title={t('today.generate')} />
        <Button title={t('today.generating')} loading />
        <Button title={t('today.generate')} disabled />
        <View style={styles.row}>
          <Chip label={t('appModes.nutritionOnly')} selected />
          <Chip label={t('appModes.nutritionTraining')} />
        </View>
        <SelectChips
          label="Segmented_Picker_Component"
          value={segmentPreview}
          onChange={setSegmentPreview}
          options={[
            { label: 'D', value: 'D' },
            { label: 'W', value: 'W' },
            { label: 'M', value: 'M' },
            { label: '6M', value: '6M' },
            { label: 'Y', value: 'Y' }
          ]}
        />
        <ProgressBar value={0.62} />
        <SelectableCard
          icon={<Utensils size={19} color={lightTheme.colors.textInverse} />}
          title={t('appModes.nutritionOnly')}
          subtitle={t('onboarding.appModeNutritionOnlyHelp')}
          selected
          onPress={() => undefined}
        />
        <SelectableCard
          icon={<Dumbbell size={19} color={lightTheme.colors.training} />}
          title={t('appModes.nutritionTraining')}
          subtitle={t('onboarding.appModeTrainingHelp')}
          selected={false}
          onPress={() => undefined}
        />
        <View style={styles.row}>
          <StatusPill label={t('today.nutrition')} tone="nutrition" />
          <StatusPill label={t('today.training')} tone="training" />
          <StatusPill label={t('today.recovery')} tone="recovery" />
          <StatusPill label={t('health.title')} tone="health" />
        </View>
        <View style={styles.metricPreviewGrid}>
          <MetricCard label={t('today.nutrition')} value="92%" tone="nutrition" />
          <MetricCard label={t('today.training')} value="35 min" tone="training" />
          <MetricCard label={t('today.recovery')} value="78" tone="recovery" />
          <MetricCard label={t('health.title')} value="On" tone="health" />
        </View>
        <View style={styles.metricPreviewGrid}>
          <HealthMetricWidget
            label="Heart Rate"
            context="Today 08:23"
            value="60"
            unit="BPM"
            comparisonLabel="Average this week"
            comparisonValue="67 BPM"
            tone="health"
          />
          <HealthMetricWidget
            label={t('todayDashboard.steps')}
            context="Today 08:28"
            value="3,697"
            unit={t('health.steps').toLowerCase()}
            comparisonLabel="Average this week"
            comparisonValue="10,411 steps"
            tone="activity"
          />
        </View>
        <View style={[styles.metricPreviewGrid, styles.darkMetricPreviewGrid]}>
          <HealthMetricWidget
            label="Sleep"
            context="Today 05:15"
            value="6 hr 4"
            unit="min"
            comparisonLabel="Average this week"
            comparisonValue="7 hr 29 min"
            tone="sleep"
            appearance="dark"
          />
          <HealthMetricWidget
            label="Stand Minutes"
            context="Today 08:28"
            value="97"
            unit="min"
            comparisonLabel="Average this week"
            comparisonValue="186 min"
            tone="activity"
            appearance="dark"
          />
        </View>
        <MiniBarChart values={[4, 8, 5, 12, 9, 16, 11]} color={lightTheme.colors.health} />
        <View style={styles.ringPreviewRow}>
          <CircularProgressRing
            value={68}
            label="68%"
            gradientColors={dashboardRingGradients.nutrition}
            trackColor="#D9FFF4"
            accessibilityLabel={t('todayDashboard.nutritionProgress')}
          />
          <CircularProgressRing
            value={42}
            label="42%"
            gradientColors={dashboardRingGradients.training}
            trackColor="#E4ECFF"
            accessibilityLabel={t('todayDashboard.trainingProgress')}
          />
          <CircularProgressRing
            value={null}
            label={t('todayDashboard.rest')}
            gradientColors={dashboardRingGradients.rest}
            trackColor="#E4ECFF"
            emptyArcValue={18}
            accessibilityLabel={t('todayDashboard.restDay')}
          />
        </View>
        <View style={styles.ringPreviewRow}>
          <CircularProgressRing
            value={0}
            label="0%"
            gradientColors={dashboardRingGradients.nutrition}
            trackColor="#D9FFF4"
            accessibilityLabel="0% state"
          />
          <CircularProgressRing
            value={100}
            label="100%"
            gradientColors={dashboardRingGradients.training}
            trackColor="#E4ECFF"
            accessibilityLabel="100% state"
          />
        </View>
        <View style={styles.dashboardPreviewGrid}>
          <DashboardProgressCard
            title={t('todayDashboard.nutritionProgress')}
            value={68}
            subtitle={t('todayDashboard.mealsTracked', { marked: '2', total: '3' })}
            hint={t('todayDashboard.caloriesTarget', { current: '1,240', target: '1,850' })}
            tone="nutrition"
            accessibilityLabel={t('todayDashboard.nutritionProgress')}
          />
          <DashboardProgressCard
            title={t('todayDashboard.trainingProgress')}
            value={42}
            subtitle={t('todayDashboard.exercisesDone', { completed: '2', total: '5' })}
            hint={t('todayDashboard.controlledIntensity')}
            tone="training"
            accessibilityLabel={t('todayDashboard.trainingProgress')}
          />
        </View>
        <WearableSummaryCard
          wearable={previewWearableSnapshot}
          connections={[]}
          locale="en-US"
          onOpenHealth={() => undefined}
        />
        <ContextNoteCard
          title={t('contextNotes.recoveryTitle')}
          message={t('contextNotes.gentlerRecovery')}
          tone="recovery"
        />
        <AIRecommendationEntry
          title="AI Coach"
          summary="A concise daily coach summary opens in a bottom sheet."
          badge="Ready"
          onPress={() => setCoachVisible(true)}
        />
        <ProviderConnectionCard
          icon={<Apple size={22} color={lightTheme.colors.health} />}
          name="Apple Health"
          statusLabel={t('health.connected')}
          statusTone="success"
          description="Connect health data for smarter daily plans."
          helper={t('health.todayAt', { time: '08:28' })}
        />
        <ProviderConnectionCard
          icon={<HeartPulse size={22} color={lightTheme.colors.training} />}
          name={t('health.healthConnect')}
          statusLabel={t('health.comingSoon')}
          description="Android health data foundation."
        />
        <View style={styles.metricPreviewGrid}>
          <MacroMetricWidget label={t('food.calories')} value={520} unit="kcal" tone="nutrition" />
          <MacroMetricWidget label={t('today.protein')} value={34} unit="g" tone="protein" />
          <MacroMetricWidget label={t('today.carbs')} value={58} unit="g" tone="carbs" />
          <MacroMetricWidget label={t('today.fat')} value={14} unit="g" tone="fat" />
        </View>
        <MealProgressWidget foodLog={previewFoodLog} trackingUnavailable={false} />
        <PremiumMealCard
          meal={previewMeal}
          foodLog={previewFoodLog}
          onPress={() => undefined}
          onUpdateStatus={() => undefined}
        />
        <AppToast title={t('feedback.savedSuccessfully')} message={t('food.mealRegenerated')} tone="success" />
        <WorkoutCardV2
          label={t('training.title')}
          title="Upper body strength"
          subtitle="Chest - Back - Shoulders"
          meta="42 min - controlled intensity"
          statusLabel={t('schedule.trainingDay')}
          statusTone="training"
        >
          <View style={styles.row}>
            <Dumbbell size={18} color={lightTheme.colors.training} />
            <AppText variant="caption">3 exercises - 9 working sets</AppText>
          </View>
        </WorkoutCardV2>
        <TrainingStatusCard
          label={t('training.title')}
          title={t('training.todaysWorkout')}
          subtitle="Upper body strength"
          meta="42 min · 3 exercises"
          statusLabel={t('schedule.trainingDay')}
          statusTone="training"
        />
        <TrainingLoadInsightCard
          title={t('trainingLoad.title')}
          status={t('trainingLoad.controlled')}
          message={t('trainingLoad.takeLongerRests')}
          bullets={[t('trainingLoad.savedRoutine'), t('workout.safetyMessage')]}
          tone="training"
        />
        <WeeklyRoutinePreviewCard
          title={t('schedule.weeklySchedule')}
          subtitle={t('schedule.weeklyScheduleHelp')}
          onDayPress={() => undefined}
          days={[
            { key: 'MONDAY', dayLabel: 'Mon', title: 'Upper', meta: '40 min', isTrainingDay: true, accessibilityLabel: 'Monday, training day' },
            { key: 'TUESDAY', dayLabel: 'Tue', title: t('schedule.restDay'), isTrainingDay: false, accessibilityLabel: 'Tuesday, rest day' },
            { key: 'WEDNESDAY', dayLabel: 'Wed', title: 'Legs', meta: '45 min', isTrainingDay: true, accessibilityLabel: 'Wednesday, training day' }
          ]}
        />
        <WorkoutProgressHeader
          title={t('workout.title')}
          subtitle="Today · 08:20"
          progressPercent={42}
          completedExercises={1}
          totalExercises={3}
          completedSets={4}
          totalSets={9}
          exercisesLabel={t('workout.exercisesLabel')}
          setsLabel={t('workout.setsLabel')}
          completedLabel={t('workout.workoutCompleted')}
          isCompleted={false}
          isPartial={false}
        />
        <WorkoutExerciseCardSurface
          title="Bodyweight squat"
          subtitle="3 sets · Reps: 10 · Rest: 60 sec"
          completed={false}
        >
          <AppText variant="caption">{t('workout.keepWorkoutControlled')}</AppText>
        </WorkoutExerciseCardSurface>
        <WorkoutHistoryCard
          label="Jul 8"
          title="Lower body"
          subtitle="9 sets · 3 exercises"
          statusLabel={t('workout.workoutCompleted')}
          isPartial={false}
          accessibilityLabel="Completed lower body workout"
          onPress={() => undefined}
        />
        <SafetyDecisionCard title={t('workout.painConflictTitle')} message={t('workout.painConflictMessage')} />
        <ReplacementProposalCard
          original={`${t('workout.originalExercise')}: Jump squat`}
          replacement="Box squat"
          reason={t('workout.replacementReason')}
          accessibilityLabel="Jump squat replaced with Box squat"
        />
        <UICard>
          <SettingsListItem
            icon={<Settings size={18} color={lightTheme.colors.health} />}
            tone="settings"
            title={t('settings.application')}
            subtitle={t('settings.futureControls')}
            value="v2"
          />
          <SettingsListItem
            icon={<Utensils size={18} color={lightTheme.colors.nutrition} />}
            tone="nutrition"
            title={t('food.title')}
            subtitle={t('food.intro')}
            statusLabel={t('settings.upgradeSoon')}
            statusTone="info"
          />
          <SettingsListItem
            icon={<Crown size={18} color={lightTheme.colors.recovery} />}
            tone="plan"
            title={t('settings.subscription')}
            subtitle={t('settings.accountHelp')}
          />
        </UICard>
      </UICard>

      <UICard>
        <AppText variant="heading">{t('designSystem.icons')}</AppText>
        <View style={styles.iconGrid}>
          {iconNames.map((name) => (
            <View key={name} style={styles.iconItem}>
              <AppIcon name={name} color={lightTheme.colors.brand} />
              <AppText variant="caption">{name}</AppText>
            </View>
          ))}
        </View>
      </UICard>

      <EmptyState title={t('designSystem.emptyState')} message={t('designSystem.emptyMessage')} />
      <ErrorState title={t('designSystem.errorState')} message={t('designSystem.errorMessage')} actionTitle={t('common.retry')} onAction={() => undefined} />
      <AICoachBottomSheet visible={coachVisible} plan={null} onClose={() => setCoachVisible(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: lightTheme.spacing.lg,
    padding: lightTheme.spacing.lg,
    backgroundColor: lightTheme.colors.background
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: lightTheme.spacing.sm },
  swatchGrid: { gap: lightTheme.spacing.sm },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: lightTheme.spacing.sm },
  swatch: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: lightTheme.colors.border },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: lightTheme.spacing.md },
  iconItem: { width: 72, alignItems: 'center', gap: lightTheme.spacing.xs },
  darkCard: {
    backgroundColor: darkTheme.colors.card,
    borderColor: darkTheme.colors.border
  },
  darkText: {
    color: darkTheme.colors.textPrimary
  },
  darkMuted: {
    color: darkTheme.colors.textSecondary
  },
  semanticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: lightTheme.spacing.sm
  },
  semanticCard: {
    minWidth: '45%',
    borderRadius: lightTheme.radius.lg,
    padding: lightTheme.spacing.md,
    gap: lightTheme.spacing.sm
  },
  semanticDot: {
    width: 28,
    height: 6,
    borderRadius: lightTheme.radius.pill
  },
  metricPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: lightTheme.spacing.sm
  },
  darkMetricPreviewGrid: {
    backgroundColor: darkTheme.colors.backgroundMuted,
    borderRadius: lightTheme.radius.xl,
    padding: lightTheme.spacing.sm
  },
  ringPreviewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: lightTheme.spacing.md,
    justifyContent: 'center'
  },
  dashboardPreviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: lightTheme.spacing.sm
  }
});
