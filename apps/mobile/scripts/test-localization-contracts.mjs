import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import i18next from 'i18next';

const mobileRoot = resolve(import.meta.dirname, '..');
const workspaceRoot = resolve(mobileRoot, '../..');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const localeCache = new Map();

const shared = loadTypeScriptModule(
  resolve(workspaceRoot, 'packages/shared-types/src/index.ts'),
  () => ({})
);
const formatters = loadTypeScriptModule(
  resolve(mobileRoot, 'src/i18n/formatters.ts'),
  (specifier) => {
    if (specifier === '@optime/shared-types') return shared;
    throw new Error(`Unexpected import in formatters: ${specifier}`);
  }
);

const detectionCases = new Map([
  ['en-GB', 'en-US'], ['ru-AM', 'ru-RU'], ['fr-CA', 'fr-FR'],
  ['zh-CN', 'zh-CN'], ['zh-Hans', 'zh-CN'], ['zh-TW', 'en-US'], ['es-419', 'en-US']
]);
for (const [input, expected] of detectionCases) {
  assert(shared.resolveSupportedLocale(input) === expected, `${input} should resolve to ${expected}.`);
}

assert(formatters.formatWeight(70, 'en-US', 'METRIC') === '70 kg', 'Metric weight formatting changed.');
assert(formatters.formatWeight(70, 'en-US', 'IMPERIAL') === '154.3 lb', 'Imperial weight formatting changed.');
assert(formatters.formatHeight(180, 'en-US', 'METRIC') === '180 cm', 'Metric height formatting changed.');
assert(formatters.formatHeight(180, 'en-US', 'IMPERIAL') === '5 ft 11 in', 'Imperial height formatting changed.');
assert(formatters.formatNumber(1234.5, 'fr-FR') !== formatters.formatNumber(1234.5, 'en-US'), 'Locale-aware decimal formatting is inactive.');
assert(formatters.formatPercentage(0.42, 'en-US') === '42%', 'Percentage formatting changed.');
assert(formatters.formatDate('2000-01-15', 'en-US') === 'Jan 15, 2000', 'Date-only formatting changed.');

const bootstrap = readFileSync(resolve(mobileRoot, 'src/providers/app-providers.tsx'), 'utf8');
assert(bootstrap.includes('settings.data.initialized'), 'Saved settings must override device detection.');
assert(bootstrap.includes('detectDeviceLocale()'), 'Uninitialized settings must use device locale detection.');

const localeModules = {
  'en-US': ['en-US.ts', 'enUS'],
  'ru-RU': ['ru-RU.ts', 'ruRU'],
  'fr-FR': ['fr-FR.ts', 'frFR'],
  'zh-CN': ['zh-CN.ts', 'zhCN']
};
const resources = Object.fromEntries(Object.entries(localeModules).map(([locale, [file, exportName]]) => [
  locale,
  { translation: loadLocaleModule(resolve(mobileRoot, 'src/i18n/locales', file))[exportName] }
]));
const instance = i18next.createInstance();
await instance.init({ lng: 'en-US', fallbackLng: 'en-US', resources, interpolation: { escapeValue: false }, showSupportNotice: false });
for (const [locale, expectedToday] of [['en-US', 'Today'], ['ru-RU', 'Сегодня'], ['fr-FR', "Aujourd'hui"], ['zh-CN', '今日']]) {
  await instance.changeLanguage(locale);
  assert(instance.t('tabs.today') === expectedToday, `${locale} runtime switch did not update Today.`);
  assert(instance.t('enums.muscleGroup.BICEPS') !== 'BICEPS', `${locale} BICEPS label is not localized.`);
  assert(instance.t('plan.foodTab') !== 'plan.foodTab', `${locale} Food tab is not localized.`);
  assert(instance.t('plan.trainingTab') !== 'plan.trainingTab', `${locale} Training tab is not localized.`);
  assert(instance.t('plan.mediaPage', { current: '2', total: '3' }).includes('2'), `${locale} media position is invalid.`);
  assert(instance.t('enums.exerciseEquipment.DUMBBELLS') !== 'DUMBBELLS', `${locale} exercise equipment is not localized.`);
  assert(instance.t('bodyMap.select', { muscle: instance.t('enums.muscleGroup.CALVES'), side: instance.t('bodyMap.sideLeft') }).length > 4, `${locale} Body Map accessibility label is invalid.`);
}
assert(instance.t('progressive.trainingLevelTitle') !== 'progressive.trainingLevelTitle', 'Progressive prompts must be localized.');

const personalForm = readFileSync(resolve(mobileRoot, 'src/features/profile/PersonalProfileForm.tsx'), 'utf8');
assert(personalForm.includes('toDisplayMeasurement') && personalForm.includes('toCanonicalMeasurement'), 'Editable profile conversion back to canonical units is missing.');
const settingsScreen = readFileSync(resolve(mobileRoot, 'app/(tabs)/profile.tsx'), 'utf8');
assert(!settingsScreen.includes('generateDailyPlan'), 'Language or unit changes must not regenerate plans.');

console.log('Localization contract tests passed.');

function loadLocaleModule(path) {
  if (localeCache.has(path)) return localeCache.get(path);
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
    fileName: path
  }).outputText;
  const module = { exports: {} };
  localeCache.set(path, module.exports);
  const localRequire = (specifier) => {
    if (!specifier.startsWith('.')) return {};
    return loadLocaleModule(resolve(dirname(path), `${specifier.replace(/\.js$/, '')}.ts`));
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  localeCache.set(path, module.exports);
  return module.exports;
}

function loadTypeScriptModule(path, requireImpl) {
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      esModuleInterop: true
    },
    fileName: path
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(requireImpl, module, module.exports);
  return module.exports;
}
