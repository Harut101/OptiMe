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
  "t('training.emptyTitle')", 'TrainingSetupForm', "t('common.save')", "t('common.cancel')",
  "t('training.savedMessage')", 'useUnsavedChangesGuard',
  'setValue(savedValue)', 'saveTrainingPreferences', 'saveMutation.isPending || !dirty'
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

for (const [name, source] of [
  ['Food', food], ['Training', training], ['Profile', profile], ['Goals', goalEditor]
]) {
  assert(!source.includes('generateDailyPlan'), `${name} must not regenerate the current plan.`);
  assert(!source.includes('daily-plans/generate'), `${name} must not call the generation endpoint.`);
  assert(source.includes('isDraftDirty') || name === 'Goals', `${name} must use shared dirty comparison.`);
}

const health = read('app/health-data.tsx');
assertIncludes(health, ["t('health.sync')", "t('health.disconnect')", "t('health.deleteData')"], 'Connections');
assert(!profile.includes('WHOOP'), 'Unsupported WHOOP provider must not be shown.');

console.log('Screen interaction contracts passed.');
