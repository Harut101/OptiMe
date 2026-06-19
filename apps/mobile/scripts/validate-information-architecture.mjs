import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const tabs = read('app/(tabs)/_layout.tsx');
for (const route of ['today', 'food', 'training', 'profile']) {
  assert(tabs.includes(`name="${route}"`), `Missing ${route} bottom tab.`);
}

const foodForm = read('src/features/food-preferences/FoodPreferencesForm.tsx');
const trainingForm = read('src/features/training-preferences/TrainingSetupForm.tsx');
assert(!foodForm.includes('expo-router'), 'FoodPreferencesForm must not navigate.');
assert(!trainingForm.includes('expo-router'), 'TrainingSetupForm must not navigate.');
assert(!foodForm.includes('@/api/'), 'FoodPreferencesForm must not persist data.');
assert(!trainingForm.includes('@/api/'), 'TrainingSetupForm must not persist data.');
assert(trainingForm.includes('BodyMapSelector'), 'TrainingSetupForm must render BodyMapSelector.');

const foodStandalone = read('app/(tabs)/food.tsx');
const foodOnboarding = read('app/(onboarding)/nutrition-preferences.tsx');
const trainingStandalone = read('app/(tabs)/training.tsx');
const trainingOnboarding = read('app/(onboarding)/training-preferences.tsx');
assert(foodStandalone.includes('FoodPreferencesForm'), 'Food tab must use the shared food form.');
assert(foodOnboarding.includes('FoodPreferencesForm'), 'Onboarding must use the shared food form.');
assert(trainingStandalone.includes('TrainingSetupForm'), 'Training tab must use the shared training form.');
assert(trainingOnboarding.includes('TrainingSetupForm'), 'Onboarding must use the shared training form.');

for (const [name, source] of [['Food', foodStandalone], ['Training', trainingStandalone]]) {
  assert(!source.includes('generateDailyPlan'), `${name} save must not regenerate a plan.`);
  assert(!source.includes("['today-plan']"), `${name} save must not invalidate the current plan.`);
}

const profile = read('app/(tabs)/profile.tsx');
for (const section of ['Personal', 'Health', 'Connections', 'Settings']) {
  assert(profile.includes(`'${section}'`), `Profile is missing ${section}.`);
}

const goalsForm = read('src/features/goals/GoalsForm.tsx');
const goalsOnboarding = read('app/(onboarding)/goal.tsx');
const goalsStandalone = read('app/goal-editor.tsx');
assert(!goalsForm.includes('expo-router'), 'GoalsForm must not navigate.');
assert(!goalsForm.includes('@/api/'), 'GoalsForm must not persist data.');
assert(goalsOnboarding.includes('GoalsForm'), 'Onboarding must use the shared goals form.');
assert(goalsStandalone.includes('GoalsForm'), 'Standalone goals must use the shared goals form.');
assert(!goalsStandalone.includes('generateDailyPlan'), 'Goal save must not regenerate a plan.');

const bodyMap = read('src/features/body-map/BodyMapSelector.tsx');
assert(bodyMap.includes("'#FF2D55'"), 'Body Map selected color changed.');
assert(bodyMap.includes('BODY_MAP_CARD_ASPECT_RATIO = 4 / 5'), 'Body Map outer ratio changed.');

console.log('Information architecture validator passed.');
