import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const locales = [
  ['en-US', 'enUS'],
  ['ru-RU', 'ruRU'],
  ['fr-FR', 'frFR'],
  ['zh-CN', 'zhCN']
];
const moduleCache = new Map();

const resources = new Map();
for (const [locale, exportName] of locales) {
  const path = resolve(root, `src/i18n/locales/${locale}.ts`);
  assert(existsSync(path), `Missing locale resource: ${locale}`);
  resources.set(locale, loadTypeScriptModule(path)[exportName]);
}

for (const unsupported of ['es-419', 'de-DE']) {
  assert(!existsSync(resolve(root, `src/i18n/locales/${unsupported}.ts`)), `${unsupported} must remain disabled.`);
}

const english = flatten(resources.get('en-US'));
for (const [locale] of locales.slice(1)) {
  const translated = flatten(resources.get(locale));
  assert(translated.size === english.size, `${locale} effective resource has a different key count.`);
  for (const [key, sourceValue] of english) {
    assert(translated.has(key), `${locale} is missing translation key ${key}.`);
    assert(typeof translated.get(key) === 'string' && translated.get(key).trim(), `${locale}.${key} must be non-empty.`);
    const sourceParams = interpolationParams(sourceValue);
    const translatedParams = interpolationParams(translated.get(key));
    assert(sourceParams.join('|') === translatedParams.join('|'), `${locale}.${key} interpolation parameters do not match English.`);
  }
}

const requiredEnumValues = {
  goalType: ['HEALTHY_LIFESTYLE', 'IMPROVE_FITNESS', 'BUILD_MUSCLE', 'IMPROVE_ENDURANCE', 'REDUCE_WEIGHT'],
  goalImpact: ['NUTRITION_ONLY', 'NUTRITION_AND_TRAINING'],
  gender: ['female', 'male', 'other', 'prefer_not_to_say'],
  pregnancyStatus: ['NOT_PREGNANT', 'PREGNANT', 'POSTPARTUM', 'BREASTFEEDING', 'PREFER_NOT_TO_SAY', 'UNKNOWN'],
  activityLevel: ['LOW', 'LIGHT', 'MODERATE', 'HIGH', 'ATHLETE'],
  dietType: ['NONE', 'OMNIVORE', 'VEGETARIAN', 'VEGAN', 'PESCATARIAN', 'KETO', 'LOW_CARB', 'MEDITERRANEAN', 'HALAL', 'KOSHER'],
  trainingOutcome: ['STRENGTH', 'MUSCLE_GROWTH', 'ENDURANCE', 'MOBILITY', 'GENERAL_FITNESS'],
  trainingLevel: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
  equipment: ['GYM', 'HOME', 'DUMBBELLS', 'BODYWEIGHT', 'MACHINES'],
  sportType: ['RUNNING', 'CYCLING', 'GYM', 'STRENGTH', 'HIIT', 'YOGA', 'SWIMMING', 'WALKING', 'TEAM_SPORT', 'OTHER'],
  intensity: ['LOW', 'MODERATE', 'HIGH'],
  measurementSystem: ['METRIC', 'IMPERIAL'],
  healthProvider: ['APPLE_HEALTH', 'HEALTH_CONNECT'],
  subscriptionPlan: ['FREE', 'PLUS', 'PRO'],
  planQualityMode: ['BASIC', 'PERSONALIZED', 'ADAPTIVE'],
  exerciseEquipment: ['NONE', 'BODYWEIGHT', 'DUMBBELLS', 'BARBELL', 'KETTLEBELL', 'RESISTANCE_BANDS', 'MACHINES', 'BENCH', 'PULL_UP_BAR', 'CABLE_MACHINE', 'CARDIO_MACHINE'],
  exerciseCategory: ['STRENGTH', 'MOBILITY', 'CARDIO', 'RECOVERY'],
  movementPattern: ['SQUAT', 'HINGE', 'HORIZONTAL_PUSH', 'VERTICAL_PUSH', 'HORIZONTAL_PULL', 'VERTICAL_PULL', 'LUNGE', 'CARRY', 'ROTATION', 'ANTI_ROTATION', 'CORE_FLEXION', 'CORE_STABILITY', 'ISOLATION', 'MOBILITY', 'CARDIO', 'RECOVERY'],
  readiness: ['PUSH', 'MAINTAIN', 'RECOVER']
};
for (const [group, values] of Object.entries(requiredEnumValues)) {
  for (const value of values) assert(english.has(`enums.${group}.${value}`), `Missing enum label enums.${group}.${value}.`);
}

const i18n = read('src/i18n/index.ts');
assert(i18n.includes('fallbackLng: DEFAULT_LOCALE'), 'i18n fallback must use DEFAULT_LOCALE.');
const tabs = read('app/(tabs)/_layout.tsx');
for (const key of ['today', 'food', 'training', 'profile']) assert(tabs.includes(`t('tabs.${key}')`), `Tab ${key} must be localized.`);

const languageOptions = read('src/i18n/language-options.ts');
for (const [locale] of locales) assert(languageOptions.includes(`value: '${locale}'`), `Language selector is missing ${locale}.`);
assert(!languageOptions.includes('es-419') && !languageOptions.includes('de-DE'), 'Future locales must not be selectable.');

const today = read('app/(tabs)/today.tsx');
const details = read('app/plan-details.tsx');
const planContent = read('src/features/daily-plan/PlanTabbedContent.tsx');
assert(today.includes('plan.summary.title') && today.includes('plan.summary.message'), 'Today must render stored plan text directly.');
assert(planContent.includes('exercise.name') && details.includes('plan.reminders.map'), 'Plan Details must render stored AI content directly.');
assert(!today.includes("t(plan.summary") && !planContent.includes("t(exercise.name"), 'Stored AI content must not be passed through translation lookup.');

const client = read('src/api/client.ts');
assert(client.includes("'Accept-Language',") && client.includes('resolveSupportedLocale'), 'API requests must propagate a validated locale.');
const settings = read('app/(tabs)/profile.tsx');
assert(settings.includes('getSettings') && settings.includes('updateSettings'), 'Settings must persist locale and measurement system.');
assert(!settings.includes('generateDailyPlan'), 'Changing settings must not regenerate a plan.');

console.log(`Localization validator passed (${locales.length} locales, ${english.size} effective keys).`);

function flatten(value, prefix = '', result = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, path, result);
    else result.set(path, child);
  }
  return result;
}

function interpolationParams(value) {
  return [...String(value).matchAll(/{{\s*([\w.]+)\s*}}/g)].map((match) => match[1]).sort();
}

function loadTypeScriptModule(path) {
  if (moduleCache.has(path)) return moduleCache.get(path);
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
    fileName: path
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(path, module.exports);
  const localRequire = (specifier) => {
    if (!specifier.startsWith('.')) return {};
    const target = resolve(dirname(path), `${specifier.replace(/\.js$/, '')}.ts`);
    return loadTypeScriptModule(target);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  moduleCache.set(path, module.exports);
  return module.exports;
}
