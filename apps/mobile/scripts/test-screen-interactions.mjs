import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const assertIncludes = (source, values, screen) => {
  for (const value of values) assert(source.includes(value), `${screen} is missing interaction contract: ${value}`);
};

const draftStateSource = read('src/features/editor/draft-state.ts');
const isDraftDirty = new Function(
  `${draftStateSource
    .replace('export ', '')
    .replace('isDraftDirty<T>', 'isDraftDirty')
    .replace('value: T', 'value')
    .replace('persistedValue: T', 'persistedValue')}; return isDraftDirty;`
)();
const persistedDraft = { value: 'saved', nested: ['A'] };
assert(!isDraftDirty(persistedDraft, persistedDraft), 'Persisted values must start clean.');
assert(isDraftDirty({ ...persistedDraft, value: 'changed' }, persistedDraft), 'A real change must become dirty.');
assert(!isDraftDirty({ value: 'saved', nested: ['A'] }, persistedDraft), 'Reverting must clear dirty state.');

const tabs = read('app/(tabs)/_layout.tsx');
for (const tab of ['today', 'food', 'training', 'profile']) {
  assert(tabs.includes(`name="${tab}"`), `${tab} tab is missing.`);
}
assert(!tabs.includes('name="settings"'), 'Obsolete Settings tab must be absent.');
assert(!existsSync(resolve(root, 'app/(tabs)/settings.tsx')), 'Obsolete Settings screen must be removed.');

const food = read('app/(tabs)/food.tsx');
assertIncludes(food, [
  "queryKey: ['nutrition-preferences']", 'ScreenSkeleton',
  "t('food.emptyTitle')", 'FoodPreferencesForm', "t('common.save')", "t('common.cancel')",
  "t('food.savedMessage')", 'useUnsavedChangesGuard',
  'setValue(savedValue)', 'saveNutritionPreferences', 'mutation.isPending || !dirty'
], 'Food');

const training = read('app/(tabs)/training.tsx');
assertIncludes(training, [
  "queryKey: ['today-plan']", 'ScreenSkeleton',
  "t('training.disabledTitle')", "t('training.disabledMessage')", "t('training.enableTraining')",
  "router.push('/goal-editor')", 'DailyTrainingPlanContent', "t('training.intro')"
], 'Today Training');
assert(!training.includes('TrainingSetupForm') && !training.includes('WeeklyRoutinePreviewCard'), 'Training tab must not mix daily training with future settings.');

const trainingForm = read('src/features/training-preferences/TrainingSetupForm.tsx');
assertIncludes(trainingForm, [
  'targetMuscleGroups', 'toTrainingPreferenceRequest', "t('training.defaultEquipment')"
], 'TrainingSetupForm');
assert(!trainingForm.includes("t('training.preferredDays')"), 'Preferred training days must not appear in Training Setup.');
assert(!trainingForm.includes("t('training.limitationsLabel')"), 'Pain or limitations must not be collected as global Training Setup.');
assert(!trainingForm.includes("'GYM', 'HOME'"), 'Training Setup must not mix environment values into equipment defaults.');
assert(!trainingForm.includes('path.id'), 'Training preference payload must never persist SVG path IDs.');

const profile = read('app/(tabs)/profile.tsx');
assertIncludes(profile, [
  'PersonalProfileForm',
  "t('profile.hubIntro')",
  "t('profile.editProfile')",
  'GoalNutritionSection',
  'TrainingHubSection',
  'SettingsListItem',
  'AppToast',
  'AppFeedbackSheet',
  'PlanImpactPromptCard',
  'GoalsForm',
  "router.push('/health-data')",
  'useUnsavedChangesGuard',
  'setValue(savedValue)'
], 'Profile');

const personalForm = read('src/features/profile/PersonalProfileForm.tsx');
assertIncludes(personalForm, [
  "t('profile.weight'", "t('profile.height'", "t('profile.activity')", "t('profile.pregnancyContext')",
  "value.gender === 'female'", 'DateField'
], 'PersonalProfileForm');
const trainingScheduleForm = read('src/features/training-schedule/TrainingScheduleForm.tsx');
assertIncludes(trainingScheduleForm, ['TimeField', "t('schedule.time')"], 'TrainingScheduleForm native time input');
const bottomSheet = read('src/components/BottomSheet.tsx');
assertIncludes(bottomSheet, ['KeyboardAvoidingView', 'automaticallyAdjustKeyboardInsets', 'keyboardShouldPersistTaps="handled"'], 'Bottom sheet keyboard handling');

const goalEditor = read('app/goal-editor.tsx');
assertIncludes(goalEditor, [
  "queryKey: ['goal']", 'ScreenSkeleton', "t('goals.emptyTitle')", 'GoalsForm',
  "t('common.save')", "t('common.cancel')", 'useUnsavedChangesGuard', 'setValue(persistedValue)',
  "t('goals.savedMessage')", 'saveGoal'
], 'Goals');
assert(goalEditor.includes('mutation.isPending || !dirty'), 'Goals must prevent empty or duplicate saves.');

const goalsForm = read('src/features/goals/GoalsForm.tsx');
const onboardingGoal = read('app/(onboarding)/goal.tsx');
const onboardingProfile = read('app/(onboarding)/profile.tsx');
const onboardingNutrition = read('app/(onboarding)/nutrition-preferences.tsx');
const onboardingLayout = read('app/(onboarding)/_layout.tsx');
const onboardingTrainingNextStep = read('app/(onboarding)/training-next-step.tsx');
const authWelcome = read('app/(auth)/welcome.tsx');
const authLogin = read('app/(auth)/login.tsx');
const authRegister = read('app/(auth)/register.tsx');
const appLayout = read('app/_layout.tsx');
const authLayout = read('app/(auth)/_layout.tsx');
const field = read('src/components/Field.tsx');
const brandLogo = read('src/components/BrandLogo.tsx');
const launchSplash = read('src/components/AppLaunchSplash.tsx');
assert(goalsForm.includes('PRIMARY_GOAL_VALUES') && goalsForm.includes('getPrimaryGoalLabel'), 'Goal labels must be centralized.');
assert(!goalsForm.includes('expo-router'), 'GoalsForm must not navigate.');
assert(!goalsForm.includes('@/api/'), 'GoalsForm must not persist data.');
assert(onboardingGoal.includes('GoalsForm'), 'Onboarding must reuse GoalsForm.');
assertIncludes(authWelcome, ["t('auth.valueNutrition')", "t('auth.valueTraining')", "t('auth.valueHealth')", "t('auth.trustNote')"], 'Auth welcome redesign');
assertIncludes(authLogin, ['AppFeedbackSheet', "t('auth.signInSecurely')", "t('auth.checkDetails')"], 'Auth login redesign');
assertIncludes(authRegister, ['AppFeedbackSheet', "t('auth.createSecurely')", "t('auth.checkDetails')"], 'Auth register redesign');
assertIncludes(authWelcome, ['BrandLogo', 'width={252}', 'variant="title"'], 'Welcome branding');
assertIncludes(authLogin, ['BrandLogo', 'width={252}'], 'Login branding');
assertIncludes(authRegister, ['BrandLogo', 'width={252}'], 'Register branding');
assertIncludes(brandLogo, ['SvgUri', 'optime-logo-light.svg', 'optime-logo-dark.svg', "accessibilityLabel=\"OptiMe\""], 'Brand logo');
assertIncludes(launchSplash, ['BrandLogo', 'variant="icon"', 'justifyContent: \'center\''], 'Launch splash');
assertIncludes(appLayout, ['AppLaunchSplash', 'setTimeout(() => setShowLaunchSplash(false), 1600)', 'useAuthStore'], 'Launch splash timing');
assertIncludes(appLayout, ['AppBackButton', 'headerTitleAlign: \'center\'', 'headerStyle: { backgroundColor: colors.background }'], 'Root stack navigation');
assertIncludes(authLayout, ['AppBackButton', 'headerTitleAlign: \'center\'', "t('auth.login')", "t('auth.createAccount')"], 'Auth stack navigation');
assertIncludes(field, ['useState', 'inputFocused', 'onFocus?.(event)', 'borderColor: colors.accent'], 'Field focus state');
assertIncludes(tabs, ['tabBarShowLabel: false', 'tabBarActiveTintColor: colors.textPrimary', 'borderWidth: 1', 'focused ? 30 : 26'], 'Floating tab navigation');
assert(!authLogin.includes('Alert.alert') && !authRegister.includes('Alert.alert'), 'Auth must use unified feedback instead of raw alerts.');
assertIncludes(onboardingProfile, ['OnboardingStepShell', 'AppFeedbackSheet', "t('onboarding.progressProfile')"], 'Profile onboarding redesign');
assertIncludes(onboardingGoal, ['OnboardingStepShell', 'AppFeedbackSheet', "t('onboarding.progressGoal')"], 'Goal onboarding redesign');
assertIncludes(goalsForm, ['SelectableCard', "t('onboarding.appModeNutritionOnlyHelp')", "t('onboarding.appModeTrainingHelp')"], 'Goal onboarding cards');
assert(!existsSync(resolve(root, 'app/(onboarding)/training-preferences.tsx')), 'Onboarding must not include Training Setup.');
assert(!existsSync(resolve(root, 'app/(onboarding)/training-schedule/index.tsx')), 'Onboarding must not include Weekly Routine.');
assert(!onboardingLayout.includes('training-schedule'), 'Onboarding stack must not expose routine editor screens.');
assertIncludes(onboardingNutrition, ['OnboardingStepShell', 'AppFeedbackSheet', 'ensureQueryData', "'/(onboarding)/training-next-step' as Href", "'/(tabs)/today' as Href", 'router.replace(nextRoute)'], 'Nutrition onboarding routing');
assertIncludes(onboardingTrainingNextStep, [
  'OnboardingStepShell',
  "t('onboarding.trainingEnabledTitle')",
  "t('onboarding.trainingOptionalMessage')",
  "t('onboarding.setUpWeeklyRoutine')",
  "t('onboarding.skipTrainingSetup')",
  "router.replace('/(tabs)/training')",
  "router.replace('/(tabs)/today')"
], 'Optional training setup');
assert(!onboardingTrainingNextStep.includes('SelectableCard'), 'Optional training setup must not duplicate footer actions with selectable cards.');
assert(!onboardingProfile.includes('Alert.alert') && !onboardingGoal.includes('Alert.alert') && !onboardingNutrition.includes('Alert.alert'), 'Onboarding must use unified feedback instead of raw alerts.');

const planDetails = read('app/plan-details.tsx');
const planContent = read('src/features/daily-plan/PlanTabbedContent.tsx');
const weeklyRoutine = read('app/weekly-routine.tsx');
const trainingSetup = read('app/training-setup.tsx');
const exerciseCard = read('src/features/daily-plan/ExerciseCard.tsx');
const exerciseDetails = read('app/exercise-details.tsx');
const mediaCarousel = read('src/features/daily-plan/ExerciseMediaCarousel.tsx');
const exerciseApi = read('src/api/exercises.ts');
assertIncludes(planDetails, ['DailyTrainingPlanContent', "t('plan.recovery')", "t('plan.reminders')", 'topSafeArea={false}', 'SectionHeader', 'ContextNoteCard'], 'Plan Details');
assert(!planContent.includes("t('plan.recovery')") && !planContent.includes("t('plan.reminders')"), 'Recovery and reminders must remain shared outside plan tabs.');
assertIncludes(planContent, [
  "queryKey: ['exercise-summaries', locale, exerciseIds]", 'DailyTrainingPlanContent', 'TrainingContent', 'exercise.exerciseId && exercise.exerciseSnapshot'
], 'Daily training content');
assert(!planContent.includes('onMealCheckIn'), 'Plan Details must not expose a second meal-tracking interaction.');
assert(!planContent.includes('FoodContent') && !planContent.includes('PlanContentTabs'), 'Food belongs only to the Food tab.');
assertIncludes(planContent, [
  'PreWorkoutCheckCard', "t('workout.preWorkoutCheck')", "t('workout.skipPreWorkoutCheck')",
  "submit('SKIPPED')", 'preWorkoutCheck'
], 'Pre-workout check');
assertIncludes(planContent, [
  'trainingLoadAgentSnapshot',
  "t('trainingLoad.title')",
  "t('trainingLoad.exerciseCaution')",
  'getTrainingLoadReadinessLabel'
], 'Plan Details Training Load Agent guidance');
assertIncludes(exerciseCard, [
  'exercise.name', 'formatExercisePrescription', 'getMuscleGroupLabel', 'getExerciseEquipmentLabel',
  'summary?.thumbnail', 'summary?.thumbnail?.url', 'resizeMode="contain"', 'barbell-outline'
], 'Exercise card');
assert(exerciseCard.includes('return onPress ?') && exerciseCard.includes('<Pressable'), 'Only supported library exercises should open details.');
assertIncludes(exerciseDetails, [
  "queryKey: ['today-plan']", "queryKey: ['exercise-detail', locale, exerciseId]", 'exercise.exerciseSnapshot',
  'formatExercisePrescription', 'ExerciseMediaCarousel', 'snapshot.instructions', 'snapshot.coachingCues', 'snapshot.safetyNotes'
], 'Exercise details');
assertIncludes(mediaCarousel, ['source={{ uri: urlOverrides[item.id] ?? getExerciseMediaDisplayUrl(item.url) }}', 'horizontal', 'pagingEnabled', 'aspectRatio: 4 / 5', 'resizeMode="contain"', 'available.length > 1', "available.length === 0"], 'Exercise media carousel');
assert(!mediaCarousel.includes('autoplay') && !mediaCarousel.includes('infinite'), 'Exercise media must not autoplay or loop infinitely.');
assertIncludes(exerciseApi, ['`/exercises?${params.toString()}`', 'ids: uniqueIds.join', '`/exercises/${encodeURIComponent(exerciseId)}`'], 'Exercise API client');
for (const source of [planContent, exerciseCard, exerciseDetails, mediaCarousel, exerciseApi]) {
  assert(!source.includes('generateDailyPlan'), 'Daily Plan content navigation must not regenerate a plan.');
  assert(!source.includes('daily-plans/generate'), 'Daily Plan content navigation must not call generation endpoints.');
  assert(!source.includes('openai'), 'Daily Plan content navigation must not call OpenAI.');
}

for (const [name, source] of [
  ['Food', food], ['Training', training], ['Profile', profile], ['Goals', goalEditor]
]) {
  assert(!source.includes('generateDailyPlan'), `${name} must not regenerate the current plan.`);
  assert(!source.includes('daily-plans/generate'), `${name} must not call the generation endpoint.`);
  assert(source.includes('isDraftDirty') || name === 'Goals' || name === 'Training', `${name} must use shared dirty comparison when editing state exists.`);
}

const health = read('app/health-data.tsx');
assertIncludes(health, ["t('health.sync')", "t('health.disconnect')", "t('health.deleteData')", "t('health.connectionsIntro')", 'StatusPill', 'HealthMetricWidget', 'ProviderConnectionCard'], 'Connections');
assertIncludes(health, [
  "result.messageCode === 'UNAVAILABLE'",
  'getAppleHealthUnavailableMessage',
  "t('health.appleHealthNativeUnavailable')",
  'getAppleHealthResultMessage'
], 'Apple Health unavailable UI');
assertIncludes(health, [
  'formatHealthTimestamp',
  'health.todayAt',
  'health.yesterdayAt',
  'getConnectionBodyCopy',
  'getConnectionHelperCopy',
  '!isConnected ? <Text variant="muted">{t(\'health.appleHealthIosOnly\')}</Text> : null'
], 'Apple Health connection polish');
assertIncludes(health, [
  'getSnapshotMetrics',
  "snapshot.source === 'APPLE_HEALTH'",
  'hasMissingAppleHealthMetric',
  "t('health.appleHealthPartialData')",
  "t('health.workoutMinutes')"
], 'Apple Health snapshot metrics');
assert(!health.includes('console.error'), 'Expected Apple Health unavailable states must not console.error from UI.');
assert(!profile.includes('WHOOP'), 'Unsupported WHOOP provider must not be shown.');

const nativeHealthIos = read('src/features/health/native-health.ios.ts');
const nativeHealthService = read('src/features/health/native-health.service.ts');
const nativeHealthUtils = read('src/features/health/native-health.utils.ts');
assertIncludes(nativeHealthIos, [
  'readMetricSafely',
  'metric read failed',
  'resolve(null)',
  'normalized wearable snapshot payload',
  'countPresentFields(sanitized)',
  "const READ_PERMISSION_KEYS = [",
  "'StepCount'",
  "'ActiveEnergyBurned'",
  "'AppleExerciseTime'",
  "'SleepAnalysis'",
  'futureFieldsDefaultedToNull',
  'snapshot.restingHeartRateBpm = null',
  'snapshot.hrvMs = null',
  'snapshot.respiratoryRate = null'
], 'Apple Health metric hardening');
for (const advancedPermission of ['RestingHeartRate', 'HeartRateVariabilitySDNN', 'RespiratoryRate']) {
  assert(!nativeHealthIos.includes(`'${advancedPermission}'`), `Apple Health MVP must not request ${advancedPermission}.`);
}
for (const advancedRead of ['getRestingHeartRate', 'getHeartRateVariabilitySamples', 'getRespiratoryRateSamples']) {
  assert(!nativeHealthIos.includes(advancedRead), `Apple Health MVP must not read ${advancedRead}.`);
}
assertIncludes(nativeHealthService, [
  'unavailableResult',
  "messageCode: 'UNAVAILABLE'",
  'updateConnectionStatusBestEffort',
  'wearable snapshot POST failed',
  "status: 'ERROR'",
  "status: 'NEEDS_REAUTH'",
  "status: 'CONNECTED'",
  'APPLE_HEALTH_SNAPSHOT_SAVE_FAILED',
  'APPLE_HEALTH_PERMISSION_DENIED',
  'APPLE_HEALTH_NO_DATA'
], 'Apple Health sync status handling');
assertIncludes(nativeHealthUtils, [
  'sanitizeIsoDateOrNow',
  'sanitizeIntegerOrNull',
  'sanitizeNumberOrNull',
  'capturedAt'
], 'Apple Health snapshot sanitization');

const today = read('app/(tabs)/today.tsx');
assertIncludes(today, ['ScreenHeader', 'AppToast', 'ContextNoteCard', "t('today.noPlan')"], 'Today polish');
assertIncludes(today, [
  "queryClient.setQueryData(['progressive-profile', 'next-prompt']",
  'data.progressiveProfile.nextPrompt'
], 'Progressive prompt continuation');
assert(!today.includes("t('today.safetyNote')"), 'Today must not render a contextless safety-status pill.');
assert(today.includes('AppFeedbackSheet') && today.includes('limitSheetVisible'), 'Today usage limits must use a dismissible sheet, not permanent layout content.');
assert(!today.includes('title={t(\'today.limitReached\')}\n          message={`${limitMessage}'), 'Today must not render a persistent usage-limit card.');
const planImpactPrompt = read('src/features/plan-impact/PlanImpactPromptCard.tsx');
assertIncludes(planImpactPrompt, ['BottomSheet', 'Plan impact is a time-sensitive decision', 'onUpdateToday', 'onFutureOnly'], 'Plan impact action sheet');
assert(!planImpactPrompt.includes('import { Card }'), 'Plan impact must not render as a persistent card.');
assertIncludes(today, [
  'DashboardProgressCard',
  'WearableSummaryCard',
  'resolveNutritionProgress',
  'resolveTrainingProgress',
  'getHealthConnections'
], 'Today dashboard');
const todayCoachIndex = today.indexOf('<AIRecommendationEntry');
const todayWearableIndex = today.indexOf('<WearableSummaryCard');
const todayWeightIndex = today.indexOf('<WeightProgressCard');
const todayActionsIndex = today.indexOf("title={generate.isPending ? t('today.refreshing') : t('today.refresh')}");
assert(
  todayCoachIndex < todayWearableIndex &&
    todayWearableIndex < todayWeightIndex &&
    todayWeightIndex < todayActionsIndex,
  'Today content priority must be AI Coach, wearable summary, weight, then plan actions.'
);
assert(!today.includes('UsageStatus'), 'Today must not render permanent usage/limit status.');
assert(!today.includes('getUsageSummary'), 'Today must not fetch usage limits for always-visible dashboard text.');
assert(!today.includes('NutritionTargetSummaryCard'), 'Today must not duplicate the nutrition target summary.');
assert(!today.includes('FoodProgressCard'), 'Today must not duplicate Food progress below the dashboard.');
assertIncludes(today, [
  "queryKey: ['training-schedule']",
  "t('today.trainingTodayPromptTitle')",
  "t('today.trainingTodayPromptMessage')",
  "t('today.generateRestDayPlan')",
  "t('today.setUpTodaysWorkout')",
  "t('trainingOverrides.editWeeklyRoutine')",
  "t('trainingOverrides.restTodayOnly')",
  "router.push({",
  "pathname: '/training-overrides/day'",
  "returnToGenerate: '1'",
  "generateAfterOverride !== '1'",
  "generateAfterRoutine !== '1'",
  "t('today.trainingRoutineUpdatedExistingPlan')"
], 'Generate Plan training-day prompt');
assertIncludes(today, [
  'resolveHealthDataReadiness',
  'continueThroughHealthReadiness',
  'nativeHealthService.syncAppleHealthToday',
  'getHealthReadinessPromptDismissedAt',
  'dismissHealthReadinessPrompt',
  "t('health.readinessUpdateTitle')",
  "t('health.readinessConnectTitle')",
  "t('health.syncNow')",
  "t('health.continueWithoutLatestData')",
  "t('health.notNow')",
  "t('health.appleHealthNativeUnavailable')"
], 'Generate Plan health readiness prompt');
assertIncludes(food, [
  'ScreenHeader',
  'NutritionTargetSummaryCard',
  'PremiumMealCard',
  'FallbackMealPlanCard',
  'AppFeedbackSheet',
  'AppToast',
  "t('food.emptyTitle')",
  "t('food.regenerateMenu')"
], 'Food polish');
assert(!food.includes('Alert.alert'), 'Food screen must use unified feedback components instead of raw alerts.');
assert(!food.includes('MealCardV2'), 'Food screen must use premium meal cards.');
assert(!food.includes('MealProgressWidget'), 'Food screen must not duplicate meal status with a separate progress widget.');
const mealDetails = read('app/meal-details.tsx');
assertIncludes(mealDetails, [
  'topSafeArea={false}',
  'MealStatusControl',
  'MacroMetricWidget',
  'AppFeedbackSheet',
  'AppToast',
  "t('food.regenerateMeal')",
  "t('food.excludeIngredient')"
], 'Meal Details food redesign');
assert(!mealDetails.includes('Alert.alert'), 'Meal Details must use unified feedback sheets instead of raw alerts.');
assertIncludes(training, [
  'ScreenHeader',
  'DailyTrainingPlanContent',
  "queryKey: ['today-plan']",
  "t('training.intro')"
], 'Today Training workspace');
assertIncludes(trainingSetup, ['TrainingSetupForm', 'PlanImpactPromptCard'], 'Training setup');
assertIncludes(weeklyRoutine, ['WeeklyRoutinePreviewCard', "t('schedule.weeklySchedule')", 'PlanImpactPromptCard'], 'Weekly Routine settings');
assert(!training.includes('Alert.alert'), 'Training tab must use unified feedback components instead of raw alerts.');
const trainingOverrideEditor = read('app/training-overrides/day.tsx');
assertIncludes(trainingOverrideEditor, [
  "t('trainingOverrides.todayOnly')",
  "t('trainingOverrides.todayOnlyHelp')",
  'saveTrainingOverride',
  "source: value.isTrainingDay ? 'USER_SELECTED_TRAIN_TODAY' : 'USER_SELECTED_REST_TODAY'",
  "params: { generateAfterOverride: '1' }",
  "pathname: '/training-schedule/day'"
], 'Today-only training override editor');
const trainingDayEditor = read('app/training-schedule/day.tsx');
assertIncludes(trainingDayEditor, [
  'returnToGenerate',
  'saveTrainingSchedule',
  "t('schedule.usualRoutineUpdateHelp')",
  "params: { generateAfterRoutine: '1' }"
], 'Weekly Routine return-to-generate flow');
assertIncludes(profile, [
  "t('profile.hubIntro')",
  'GoalNutritionSection',
  'TrainingHubSection',
  'SettingsListItem',
  'AppToast',
  'AppFeedbackSheet',
  'PlanImpactPromptCard',
  'GoalsForm',
  "router.push('/health-data')",
  "router.push('/(tabs)/food')",
  'TrainingSetupForm',
  'saveTrainingPreferences',
  'BottomSheet',
  "router.push('/weekly-routine' as never)",
  "router.push('/workout-history')",
  'useUnsavedChangesGuard',
  'setValue(savedValue)'
], 'Profile settings hub');
assert(!profile.includes('Alert.alert'), 'Profile must use unified feedback components instead of raw alerts.');
const workoutSession = read('app/workout-session.tsx');
assertIncludes(workoutSession, [
  'trainingLoadAgentSnapshot',
  "t('trainingLoad.workoutGuidance')",
  'formatTrainingLoadSessionMessage',
  "t('trainingLoad.takeLongerRests')",
  'WorkoutProgressHeader',
  'WorkoutExerciseCardSurface',
  'AppFeedbackSheet',
  'AppToast'
], 'Workout Session Training Load Agent guidance');
assert(!workoutSession.includes('Alert.alert'), 'Workout Session must use unified feedback sheets instead of raw alerts.');
const workoutHistory = read('app/workout-history.tsx');
assertIncludes(workoutHistory, ['WorkoutHistoryCard', "t('workout.historyIntro')", 'topSafeArea={false}'], 'Workout History redesign');
assertIncludes(planContent, [
  'TrainingLoadInsightCard',
  'SafetyDecisionCard',
  'ReplacementProposalCard',
  'WorkoutActionCard'
], 'Plan Details training redesign');

for (const component of [
  'src/components/ScreenHeader.tsx',
  'src/components/SectionHeader.tsx',
  'src/components/StatusPill.tsx',
  'src/components/ContextNoteCard.tsx',
  'src/components/MetricCard.tsx'
]) {
  assert(existsSync(resolve(root, component)), `${component} must exist for the UI polish layer.`);
}

const themeColors = read('src/theme/colors.ts');
assertIncludes(themeColors, [
  'export type ThemeColors',
  'lightThemeColors',
  'darkThemeColors',
  'nutritionMuted',
  'trainingMuted',
  'recoveryMuted',
  'healthMuted',
  'primary: lightThemeColors.health',
  'themeColorsByMode'
], 'Theme colors');

const designPreview = read('app/design-system-preview.tsx');
assertIncludes(designPreview, [
  'uiDarkColors',
  'semanticEntries',
  'StatusPill',
  'MetricCard',
  'HealthMetricWidget',
  'MacroMetricWidget',
  'MealProgressWidget',
  'PremiumMealCard',
  'AppToast',
  'ContextNoteCard',
  'AIRecommendationEntry',
  'AICoachBottomSheet',
  'CircularProgressRing',
  'DashboardProgressCard',
  'WearableSummaryCard',
  'ProviderConnectionCard',
  'TrainingStatusCard',
  'TrainingLoadInsightCard',
  'WeeklyRoutinePreviewCard',
  'WorkoutProgressHeader',
  'WorkoutExerciseCardSurface',
  'WorkoutHistoryCard',
  'SafetyDecisionCard',
  'ReplacementProposalCard',
  'WorkoutCardV2',
  'MiniBarChart',
  'SettingsListItem',
  'SelectableCard',
  "<Button title={t('today.generate')} />",
  'loading />',
  'dashboardRingGradients',
  'emptyArcValue={18}',
  'tone="nutrition"',
  'tone="training"',
  'tone="recovery"',
  'tone="health"'
], 'Design System Preview visual direction');

for (const component of [
  'src/features/today-dashboard/CircularProgressRing.tsx',
  'src/features/today-dashboard/DashboardProgressCard.tsx',
  'src/features/today-dashboard/WearableSummaryCard.tsx',
  'src/features/today-dashboard/today-progress.ts'
]) {
  assert(existsSync(resolve(root, component)), `${component} must exist for the Today dashboard layer.`);
}

const circularProgressRing = read('src/features/today-dashboard/CircularProgressRing.tsx');
assertIncludes(circularProgressRing, [
  'strokeLinecap="round"',
  'interpolateGradientColor',
  'showEndCapDot',
  'accessibilityRole="progressbar"'
], 'Circular progress ring');

const dashboardProgressCard = read('src/features/today-dashboard/DashboardProgressCard.tsx');
assertIncludes(dashboardProgressCard, [
  '#00C8B3', '#34C759',
  '#0088FF', '#6155F5', '#CB30E0',
  'colors.trainingMuted', 'ringTone = isRestLikeState ?'
], 'Electric dashboard progress rings');

const metricCard = read('src/components/MetricCard.tsx');
assertIncludes(metricCard, ['MetricCardTone', 'nutritionMuted', 'trainingMuted', 'recoveryMuted', 'healthMuted'], 'MetricCard visual tuning');

const statusPill = read('src/components/StatusPill.tsx');
assertIncludes(statusPill, ['borderWidth: 1', 'nutritionMuted', 'trainingMuted', 'recoveryMuted', 'healthMuted'], 'StatusPill visual tuning');

console.log('Screen interaction contracts passed.');
