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
  "queryKey: ['nutrition-preferences']", "t('common.loading')",
  "t('food.emptyTitle')", 'FoodPreferencesForm', "t('common.save')", "t('common.cancel')",
  "t('food.savedMessage')", 'useUnsavedChangesGuard',
  'setValue(savedValue)', 'saveNutritionPreferences', 'mutation.isPending || !dirty'
], 'Food');

const training = read('app/(tabs)/training.tsx');
assertIncludes(training, [
  "queryKey: ['training-preferences']", "t('common.loading')",
  "t('training.disabledTitle')", "t('training.disabledMessage')", "t('training.enableTraining')",
  "router.push('/goal-editor')", 'TrainingSetupForm', "t('common.save')", "t('common.cancel')",
  "t('training.savedMessage')", 'useUnsavedChangesGuard',
  'setValue(savedValue)', 'saveTrainingPreferences', 'saveSettings.isPending || !settingsDirty'
], 'Training');

const trainingForm = read('src/features/training-preferences/TrainingSetupForm.tsx');
assertIncludes(trainingForm, [
  'BodyMapSelector', 'targetMuscleGroups', 'toTrainingPreferenceRequest'
], 'TrainingSetupForm');
assert(!trainingForm.includes('path.id'), 'Training preference payload must never persist SVG path IDs.');

const profile = read('app/(tabs)/profile.tsx');
assertIncludes(profile, [
  "'Personal'", "'Health'", "'Connections'", "'Settings'", 'PersonalProfileForm',
  "t('common.edit')", "router.push('/goal-editor')", "router.push('/health-data')",
  'useUnsavedChangesGuard', 'setValue(savedValue)'
], 'Profile');

const personalForm = read('src/features/profile/PersonalProfileForm.tsx');
assertIncludes(personalForm, [
  "t('profile.weight'", "t('profile.height'", "t('profile.activity')", "t('profile.pregnancyContext')",
  "value.gender === 'female'"
], 'PersonalProfileForm');

const goalEditor = read('app/goal-editor.tsx');
assertIncludes(goalEditor, [
  "queryKey: ['goal']", "t('common.loading')", "t('goals.emptyTitle')", 'GoalsForm',
  "t('common.save')", "t('common.cancel')", 'useUnsavedChangesGuard', 'setValue(persistedValue)',
  "t('goals.savedMessage')", 'saveGoal'
], 'Goals');
assert(goalEditor.includes('mutation.isPending || !dirty'), 'Goals must prevent empty or duplicate saves.');

const goalsForm = read('src/features/goals/GoalsForm.tsx');
const onboardingGoal = read('app/(onboarding)/goal.tsx');
assert(goalsForm.includes('GOAL_VALUES') && goalsForm.includes('getGoalTypeLabel'), 'Goal labels must be centralized.');
assert(!goalsForm.includes('expo-router'), 'GoalsForm must not navigate.');
assert(!goalsForm.includes('@/api/'), 'GoalsForm must not persist data.');
assert(onboardingGoal.includes('GoalsForm'), 'Onboarding must reuse GoalsForm.');

const planDetails = read('app/plan-details.tsx');
const planContent = read('src/features/daily-plan/PlanTabbedContent.tsx');
const planTabs = read('src/features/daily-plan/PlanContentTabs.tsx');
const exerciseCard = read('src/features/daily-plan/ExerciseCard.tsx');
const exerciseDetails = read('app/exercise-details.tsx');
const mediaCarousel = read('src/features/daily-plan/ExerciseMediaCarousel.tsx');
const exerciseApi = read('src/api/exercises.ts');
assertIncludes(planDetails, ['PlanTabbedContent', "t('plan.recovery')", "t('plan.reminders')", 'ScreenHeader', 'SectionHeader', 'ContextNoteCard'], 'Plan Details');
assert(!planContent.includes("t('plan.recovery')") && !planContent.includes("t('plan.reminders')"), 'Recovery and reminders must remain shared outside plan tabs.');
assertIncludes(planTabs, ['accessibilityRole="tab"', 'accessibilityState={{ selected }}', 'foodLabel', 'trainingLabel'], 'Plan content tabs');
assertIncludes(planContent, [
  "plan.nutrition.meals.length > 0 ? 'food'", "exercises.length > 0 ? 'training'", "useState<PlanContentTab>(defaultTab)",
  "queryKey: ['exercise-summaries', locale, exerciseIds]", 'FoodContent', 'TrainingContent', 'exercise.exerciseId && exercise.exerciseSnapshot'
], 'Plan tab content');
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
for (const source of [planContent, planTabs, exerciseCard, exerciseDetails, mediaCarousel, exerciseApi]) {
  assert(!source.includes('generateDailyPlan'), 'Daily Plan content navigation must not regenerate a plan.');
  assert(!source.includes('daily-plans/generate'), 'Daily Plan content navigation must not call generation endpoints.');
  assert(!source.includes('openai'), 'Daily Plan content navigation must not call OpenAI.');
}

for (const [name, source] of [
  ['Food', food], ['Training', training], ['Profile', profile], ['Goals', goalEditor]
]) {
  assert(!source.includes('generateDailyPlan'), `${name} must not regenerate the current plan.`);
  assert(!source.includes('daily-plans/generate'), `${name} must not call the generation endpoint.`);
  assert(source.includes('isDraftDirty') || name === 'Goals', `${name} must use shared dirty comparison.`);
}

const health = read('app/health-data.tsx');
assertIncludes(health, ["t('health.sync')", "t('health.disconnect')", "t('health.deleteData')", 'ScreenHeader', 'StatusPill', 'MetricCard'], 'Connections');
assert(!profile.includes('WHOOP'), 'Unsupported WHOOP provider must not be shown.');

const today = read('app/(tabs)/today.tsx');
assertIncludes(today, ['ScreenHeader', 'StatusPill', 'ContextNoteCard', "t('today.noPlan')"], 'Today polish');
assertIncludes(food, ['ScreenHeader', 'SectionHeader', 'StatusPill', "t('food.emptyTitle')"], 'Food polish');
assertIncludes(training, ['ScreenHeader', 'SectionHeader', 'StatusPill', "t('schedule.weeklySchedule')"], 'Training polish');
assertIncludes(profile, ['ScreenHeader', 'SectionHeader', 'ContextNoteCard', "profile.sections.connections"], 'Profile polish');

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
  'themeColorsByMode'
], 'Theme colors');

const designPreview = read('app/design-system-preview.tsx');
assertIncludes(designPreview, [
  'uiDarkColors',
  'semanticEntries',
  'StatusPill',
  'MetricCard',
  'ContextNoteCard',
  'tone="nutrition"',
  'tone="training"',
  'tone="recovery"',
  'tone="health"'
], 'Design System Preview visual direction');

const metricCard = read('src/components/MetricCard.tsx');
assertIncludes(metricCard, ['MetricCardTone', 'nutritionMuted', 'trainingMuted', 'recoveryMuted', 'healthMuted'], 'MetricCard visual tuning');

const statusPill = read('src/components/StatusPill.tsx');
assertIncludes(statusPill, ['borderWidth: 1', 'nutritionMuted', 'trainingMuted', 'recoveryMuted', 'healthMuted'], 'StatusPill visual tuning');

console.log('Screen interaction contracts passed.');
