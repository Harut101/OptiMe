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
  "queryKey: ['nutrition-preferences']", 'Loading food preferences',
  'Personalize your meals', 'FoodPreferencesForm', 'Save', 'Cancel',
  'Your updated preferences will be used for future plans.', 'useUnsavedChangesGuard',
  'setValue(savedValue)', 'saveNutritionPreferences', 'mutation.isPending || !dirty'
], 'Food');

const training = read('app/(tabs)/training.tsx');
assertIncludes(training, [
  "queryKey: ['training-preferences']", 'Loading training setup',
  'Complete your training setup', 'TrainingSetupForm', 'Save preferences', 'Cancel',
  'Your updated preferences will be used for future plans.', 'useUnsavedChangesGuard',
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
  'Edit personal details', "router.push('/goal-editor')", "router.push('/health-data')",
  'useUnsavedChangesGuard', 'setValue(savedValue)'
], 'Profile');

const personalForm = read('src/features/profile/PersonalProfileForm.tsx');
assertIncludes(personalForm, [
  'Weight (kg)', 'Height (cm)', 'Activity level', 'Pregnancy / postpartum context',
  "value.gender === 'female'"
], 'PersonalProfileForm');

const goalEditor = read('app/goal-editor.tsx');
assertIncludes(goalEditor, [
  "queryKey: ['goal']", 'Loading goals', 'Set your goals', 'GoalsForm',
  'Save goals', 'Cancel', 'useUnsavedChangesGuard', 'setValue(persistedValue)',
  'Your updated goals will be used for future plans.', 'saveGoal'
], 'Goals');
assert(goalEditor.includes('mutation.isPending || !dirty'), 'Goals must prevent empty or duplicate saves.');

const goalsForm = read('src/features/goals/GoalsForm.tsx');
const onboardingGoal = read('app/(onboarding)/goal.tsx');
assert(goalsForm.includes('GOAL_OPTIONS'), 'Goal labels must be centralized.');
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
assertIncludes(health, ['Sync now', 'Disconnect', 'Delete synced health data'], 'Connections');
assert(!profile.includes('WHOOP'), 'Unsupported WHOOP provider must not be shown.');

console.log('Screen interaction contracts passed.');
