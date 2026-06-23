import type {
  ExerciseCategory,
  ExerciseEquipment,
  MovementPattern,
  SupportedLocale,
  TargetMuscleGroup,
  TrainingLevel
} from '@optime/shared-types';
import {
  EXERCISE_CATEGORIES,
  EXERCISE_EQUIPMENT,
  MOVEMENT_PATTERNS,
  SUPPORTED_LOCALES,
  TARGET_MUSCLE_GROUPS,
  TRAINING_LEVELS
} from '@optime/shared-types';
import type { SeedExercise } from '../../prisma/seeds/exercises/types';
import type { ExerciseMediaReconciliationReport } from './reconciliation';

export const ALIGNMENT_STATUSES = [
  'SAFE_ALIAS',
  'NEW_EXERCISE_CANDIDATE',
  'DUPLICATE_EXERCISE',
  'UNSUPPORTED_MEDIA',
  'AMBIGUOUS_REVIEW_REQUIRED'
] as const;
export type AlignmentStatus = (typeof ALIGNMENT_STATUSES)[number];
export type AlignmentConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type AlignmentAction = 'RENAME_FILE' | 'ADD_NEW_EXERCISE' | 'EXCLUDE_MEDIA' | 'MANUAL_REVIEW';

interface ProposedExerciseInput {
  slug: string;
  names: Record<SupportedLocale, string>;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  equipment: ExerciseEquipment[];
  levels: TrainingLevel[];
  primaryMuscles: TargetMuscleGroup[];
  secondaryMuscles: TargetMuscleGroup[];
  isUnilateral: boolean;
  bodyPosition: string;
  rationale: string;
  enumLimitations?: string[];
}

interface DecisionDefinition {
  imageSlug: string;
  status: AlignmentStatus;
  proposedCanonicalSlug: string | null;
  existingExerciseSlug: string | null;
  closestExerciseSlug: string | null;
  confidence: AlignmentConfidence;
  reason: string;
  differencesFromClosestExercise: string[];
  proposedAction: AlignmentAction;
  proposedExercise?: ProposedExerciseInput;
  reviewNote?: string;
}

export interface ExerciseComparison {
  slug: string;
  canonicalEnglishName: string;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  equipment: ExerciseEquipment[];
  trainingLevels: TrainingLevel[];
  primaryMuscles: TargetMuscleGroup[];
  secondaryMuscles: TargetMuscleGroup[];
  unilateralOrBilateral: string;
  bodyPosition: string;
  movementDescription: string;
}

export interface ProposedExercise extends Omit<ProposedExerciseInput, 'names'> {
  canonicalEnglishName: string;
  isActive: true;
  translations: Record<SupportedLocale, string>;
}

export interface ExerciseMediaCatalogAlignmentItem {
  imageSlug: string;
  sourceFiles: string[];
  status: AlignmentStatus;
  proposedCanonicalSlug: string | null;
  existingExerciseSlug: string | null;
  confidence: AlignmentConfidence;
  reason: string;
  closestExistingExercise: ExerciseComparison | null;
  differencesFromClosestExercise: string[];
  proposedAction: AlignmentAction;
  proposedExercise: ProposedExercise | null;
  reviewNote?: string;
}

export interface ExerciseMediaCatalogAlignmentReport {
  schemaVersion: 'exercise-media-catalog-alignment.v1';
  sourceReconciliation: string;
  summary: {
    currentCatalogExercises: number;
    classifiedUnmatchedIdentities: number;
    safeAliases: number;
    proposedNewExercises: number;
    duplicateExercises: number;
    excludedMediaIdentities: number;
    ambiguousIdentities: number;
    projectedCatalogSize: number;
    projectedMediaCoveredExercises: number;
    remainingCatalogExercisesWithoutMedia: number;
  };
  automaticSafeDecisions: string[];
  productApprovalDecisions: string[];
  unresolvedAmbiguities: string[];
  projectedCatalogExercisesWithoutMedia: string[];
  items: ExerciseMediaCatalogAlignmentItem[];
}

const names = (en: string, ru: string, fr: string, zh: string): Record<SupportedLocale, string> => ({
  'en-US': en,
  'ru-RU': ru,
  'fr-FR': fr,
  'zh-CN': zh
});

const proposal = (
  slug: string,
  localizedNames: Record<SupportedLocale, string>,
  category: ExerciseCategory,
  movementPattern: MovementPattern,
  equipment: ExerciseEquipment[],
  levels: TrainingLevel[],
  primaryMuscles: TargetMuscleGroup[],
  secondaryMuscles: TargetMuscleGroup[],
  bodyPosition: string,
  rationale: string,
  isUnilateral = false,
  enumLimitations?: string[]
): ProposedExerciseInput => ({
  slug, names: localizedNames, category, movementPattern, equipment, levels, primaryMuscles,
  secondaryMuscles, isUnilateral, bodyPosition, rationale, ...(enumLimitations ? { enumLimitations } : {})
});

const newCandidate = (
  imageSlug: string,
  closestExerciseSlug: string | null,
  confidence: AlignmentConfidence,
  reason: string,
  differences: string[],
  proposedExercise: ProposedExerciseInput
): DecisionDefinition => ({
  imageSlug,
  status: 'NEW_EXERCISE_CANDIDATE',
  proposedCanonicalSlug: proposedExercise.slug,
  existingExerciseSlug: null,
  closestExerciseSlug,
  confidence,
  reason,
  differencesFromClosestExercise: differences,
  proposedAction: 'ADD_NEW_EXERCISE',
  proposedExercise
});

const safeAlias = (
  imageSlug: string,
  existingExerciseSlug: string,
  reason: string,
  reviewNote?: string
): DecisionDefinition => ({
  imageSlug,
  status: 'SAFE_ALIAS',
  proposedCanonicalSlug: existingExerciseSlug,
  existingExerciseSlug,
  closestExerciseSlug: existingExerciseSlug,
  confidence: 'HIGH',
  reason,
  differencesFromClosestExercise: ['No material movement difference; only the approved media filename differs from the canonical identity.'],
  proposedAction: reviewNote ? 'MANUAL_REVIEW' : 'RENAME_FILE',
  ...(reviewNote ? { reviewNote } : {})
});

export const ALIGNMENT_DECISIONS: readonly DecisionDefinition[] = [
  newCandidate('back-squat', 'goblet-squat', 'HIGH', 'A barbell back squat is a recognized loaded squat and is materially different from a front-loaded goblet squat.', ['Back-loaded barbell rather than a front-held dumbbell.', 'Higher loading and technique demands justify intermediate and advanced levels.'], proposal('back-squat', names('Back Squat', 'Приседание со штангой на спине', 'Squat avec barre sur le dos', '杠铃后蹲'), 'STRENGTH', 'SQUAT', ['BARBELL'], ['INTERMEDIATE', 'ADVANCED'], ['QUADRICEPS', 'GLUTES'], ['HAMSTRINGS', 'LOWER_BACK'], 'Standing, bilateral', 'Adds the principal barbell squat pattern without replacing the existing goblet or bodyweight variants.')),
  newCandidate('barbell-bench-press', 'dumbbell-bench-press', 'HIGH', 'The fixed barbell load and bilateral hand position create a distinct press from the dumbbell bench press.', ['Barbell instead of independent dumbbells.', 'Bilateral fixed-bar loading changes stability and range-of-motion characteristics.'], proposal('barbell-bench-press', names('Barbell Bench Press', 'Жим штанги лёжа', 'Développé couché à la barre', '杠铃卧推'), 'STRENGTH', 'HORIZONTAL_PUSH', ['BARBELL', 'BENCH'], ['INTERMEDIATE', 'ADVANCED'], ['CHEST'], ['TRICEPS', 'SHOULDERS'], 'Supine on bench, bilateral', 'Preserves equipment-specific technique and progression as its own exercise.')),
  newCandidate('barbell-curl', 'dumbbell-biceps-curl', 'HIGH', 'A bilateral fixed-bar curl is distinct from independent dumbbell curls.', ['Barbell loading rather than dumbbells.', 'Fixed bilateral grip rather than independently moving arms.'], proposal('barbell-curl', names('Barbell Curl', 'Сгибание рук со штангой', 'Curl biceps à la barre', '杠铃弯举'), 'STRENGTH', 'ISOLATION', ['BARBELL'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['BICEPS'], ['FOREARMS'], 'Standing, bilateral', 'Adds a common barbell arm exercise without conflating equipment-specific execution.')),
  newCandidate('barbell-hip-thrust', 'hip-thrust', 'HIGH', 'Product review confirmed the approved Barbell Hip Thrust image is a loaded barbell setup and is materially different from the existing non-barbell Hip Thrust media identity.', ['Requires explicit barbell loading rather than the currently approved non-barbell hip-thrust media.', 'Setup and execution context differ because the barbell-loaded variant needs external load placement, padding, and loading-specific prescription.', 'Progression options differ because the barbell variant can be prescribed and progressed separately from the non-barbell variation.'], proposal('barbell-hip-thrust', names('Barbell Hip Thrust', 'Ягодичный мост со штангой', 'Hip thrust avec barre', '杠铃臀推'), 'STRENGTH', 'HINGE', ['BENCH', 'BARBELL'], ['INTERMEDIATE', 'ADVANCED'], ['GLUTES'], ['HAMSTRINGS'], 'Supine with upper back supported on bench and loaded barbell across hips, bilateral', 'Adds the product-confirmed loaded barbell hip-thrust identity without changing the existing hip-thrust exercise or its current media.')),
  newCandidate('barbell-shoulder-press', 'dumbbell-shoulder-press', 'HIGH', 'A fixed barbell overhead press is materially distinct from the dumbbell version.', ['Barbell rather than dumbbells.', 'Fixed bilateral bar path changes stability and shoulder mechanics.'], proposal('barbell-shoulder-press', names('Barbell Shoulder Press', 'Жим штанги над головой', 'Développé épaules à la barre', '杠铃肩上推举'), 'STRENGTH', 'VERTICAL_PUSH', ['BARBELL'], ['INTERMEDIATE', 'ADVANCED'], ['SHOULDERS'], ['TRICEPS'], 'Standing or seated, bilateral', 'Adds the standard barbell vertical press as a separate progression.')),
  newCandidate('barbell-shrug', 'face-pull', 'HIGH', 'A loaded scapular elevation shrug is not a horizontal pulling exercise.', ['Isolation by scapular elevation rather than shoulder external rotation and rowing.', 'Barbell loading instead of cable and rope.'], proposal('barbell-shrug', names('Barbell Shrug', 'Шраги со штангой', 'Haussement d’épaules à la barre', '杠铃耸肩'), 'STRENGTH', 'ISOLATION', ['BARBELL'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['TRAPS'], ['FOREARMS'], 'Standing, bilateral', 'Adds a direct trapezius isolation movement.')),
  newCandidate('bench-dip', 'overhead-triceps-extension', 'MEDIUM', 'A bodyweight bench dip is a compound pressing movement, not an overhead elbow-extension isolation.', ['Bodyweight closed-chain movement using a bench.', 'Greater shoulder extension and wrist loading.'], proposal('bench-dip', names('Bench Dip', 'Отжимание от скамьи на трицепс', 'Dips sur banc', '凳上臂屈伸'), 'STRENGTH', 'HORIZONTAL_PUSH', ['BODYWEIGHT', 'BENCH'], ['INTERMEDIATE', 'ADVANCED'], ['TRICEPS'], ['CHEST', 'SHOULDERS'], 'Supported behind a bench, bilateral', 'Adds a recognizable bodyweight triceps exercise.', false, ['The current MovementPattern enum has no DIP value; HORIZONTAL_PUSH is the closest available representation.'])),
  newCandidate('bent-over-barbell-row', 'seated-cable-row', 'HIGH', 'The unsupported hip-hinged barbell row has different loading and torso demands from a seated cable row.', ['Barbell instead of cable.', 'Unsupported bent-over position adds substantial lower-back isometric load.'], proposal('bent-over-barbell-row', names('Bent-Over Barbell Row', 'Тяга штанги в наклоне', 'Rowing buste penché à la barre', '杠铃俯身划船'), 'STRENGTH', 'HORIZONTAL_PULL', ['BARBELL'], ['INTERMEDIATE', 'ADVANCED'], ['LATS', 'BACK'], ['BICEPS', 'TRAPS', 'LOWER_BACK'], 'Standing hip hinge, bilateral', 'Adds a free-weight horizontal pull with distinct bracing demands.')),
  newCandidate('butterfly-stretch', 'hip-flexor-stretch', 'HIGH', 'The seated butterfly targets hip adductors, while the existing stretch targets hip flexors.', ['Primary target is adductors rather than hip flexors.', 'Seated bilateral hip-abduction position.'], proposal('butterfly-stretch', names('Butterfly Stretch', 'Растяжка «бабочка»', 'Étirement papillon', '蝴蝶式拉伸'), 'MOBILITY', 'MOBILITY', ['BODYWEIGHT'], ['BEGINNER', 'INTERMEDIATE'], ['ADDUCTORS'], ['GLUTES'], 'Seated, bilateral', 'Adds a common gentle adductor mobility option.')),
  newCandidate('cable-bicep-curl', 'dumbbell-biceps-curl', 'HIGH', 'Continuous cable resistance is a distinct loading type from dumbbells.', ['Cable machine rather than dumbbells.', 'Continuous pulley resistance through the curl.'], proposal('cable-bicep-curl', names('Cable Biceps Curl', 'Сгибание рук на нижнем блоке', 'Curl biceps à la poulie', '绳索二头肌弯举'), 'STRENGTH', 'ISOLATION', ['CABLE_MACHINE'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['BICEPS'], ['FOREARMS'], 'Standing, bilateral', 'Adds an equipment-specific curl with distinct resistance.')),
  newCandidate('cable-hip-adduction', 'hip-adduction-machine', 'HIGH', 'Standing cable hip adduction is unilateral and balance-dependent, unlike the seated bilateral machine exercise.', ['Cable rather than seated machine.', 'Standing unilateral execution and balance requirement.'], proposal('cable-hip-adduction', names('Cable Hip Adduction', 'Приведение бедра на нижнем блоке', 'Adduction de hanche à la poulie', '绳索髋内收'), 'STRENGTH', 'ISOLATION', ['CABLE_MACHINE'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['ADDUCTORS'], ['CORE'], 'Standing, unilateral', 'Adds a unilateral cable adduction option.', true)),
  safeAlias('cable-row', 'seated-cable-row', 'Visual inspection confirms a seated bilateral cable row with foot support, matching the seeded Seated Cable Row in equipment, body position, loading, and technique.'),
  newCandidate('cable-upright-row', 'face-pull', 'HIGH', 'A cable upright row is a vertical elbow-leading pull, not a face pull.', ['Vertical pulling path rather than horizontal rope pull.', 'Primary shoulder and upper-trapezius emphasis.'], proposal('cable-upright-row', names('Cable Upright Row', 'Тяга нижнего блока к подбородку', 'Tirage vertical à la poulie', '绳索直立划船'), 'STRENGTH', 'VERTICAL_PULL', ['CABLE_MACHINE'], ['INTERMEDIATE', 'ADVANCED'], ['SHOULDERS', 'TRAPS'], ['BICEPS'], 'Standing, bilateral', 'Adds a distinct cable shoulder pull.')),
  safeAlias('calf-raise', 'standing-calf-raise', 'Visual inspection confirms an unsupported standing bodyweight calf raise, matching the seeded exercise in loading, position, range of motion, and target muscles.'),
  newCandidate('crunches', 'dead-bug', 'HIGH', 'A crunch actively flexes the trunk; a dead bug trains anti-extension stability.', ['CORE_FLEXION rather than CORE_STABILITY.', 'Bilateral trunk curl rather than alternating limb movement.'], proposal('crunches', names('Crunches', 'Скручивания', 'Crunchs', '卷腹'), 'STRENGTH', 'CORE_FLEXION', ['BODYWEIGHT'], ['BEGINNER', 'INTERMEDIATE'], ['ABS'], ['OBLIQUES'], 'Supine, bilateral', 'Adds a basic trunk-flexion exercise.')),
  newCandidate('deadlift', 'romanian-deadlift', 'HIGH', 'A conventional deadlift starts from the floor with more knee flexion; it is not a Romanian deadlift.', ['Floor start and concentric first repetition.', 'Greater knee flexion and whole-body loading.'], proposal('deadlift', names('Conventional Deadlift', 'Классическая становая тяга', 'Soulevé de terre classique', '传统硬拉'), 'STRENGTH', 'HINGE', ['BARBELL'], ['INTERMEDIATE', 'ADVANCED'], ['GLUTES', 'HAMSTRINGS'], ['LOWER_BACK', 'TRAPS', 'FOREARMS'], 'Standing floor pull, bilateral', 'Adds the conventional hinge while preserving the Romanian variation.')),
  newCandidate('dumbbell-back-fly', 'face-pull', 'HIGH', 'The approved image shows a chest-supported incline dumbbell reverse fly, distinct from a standing cable face pull.', ['Dumbbells and incline bench instead of cable and rope.', 'Prone chest-supported reverse-fly arc.'], proposal('incline-dumbbell-reverse-fly', names('Incline Dumbbell Reverse Fly', 'Обратная разводка гантелей на наклонной скамье', 'Oiseau avec haltères sur banc incliné', '上斜凳哑铃反向飞鸟'), 'STRENGTH', 'HORIZONTAL_PULL', ['DUMBBELLS', 'BENCH'], ['INTERMEDIATE', 'ADVANCED'], ['SHOULDERS', 'TRAPS'], ['BACK'], 'Prone on incline bench, bilateral', 'Uses a precise canonical identity for the movement shown by the approved image.')),
  newCandidate('farmers-carry', 'walking', 'HIGH', 'A loaded carry pattern is absent from the current catalog.', ['External bilateral load rather than unloaded cardio walking.', 'Strength-oriented CARRY pattern rather than CARDIO.'], proposal('farmers-carry', names('Farmer’s Carry', 'Прогулка фермера', 'Marche du fermier', '农夫行走'), 'STRENGTH', 'CARRY', ['DUMBBELLS'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['FULL_BODY', 'FOREARMS'], ['TRAPS', 'CORE'], 'Standing and walking, bilateral load', 'Fills the existing CARRY pattern with a practical full-body exercise.')),
  newCandidate('incline-back-extension', 'romanian-deadlift', 'HIGH', 'A supported back extension uses bodyweight and a bench rather than a standing barbell hinge.', ['Torso supported on an incline bench.', 'Bodyweight spinal and hip extension rather than barbell loading.'], proposal('incline-back-extension', names('Incline Back Extension', 'Разгибание спины на наклонной скамье', 'Extension du dos sur banc incliné', '上斜凳背部伸展'), 'STRENGTH', 'HINGE', ['BODYWEIGHT', 'BENCH'], ['INTERMEDIATE', 'ADVANCED'], ['LOWER_BACK'], ['GLUTES', 'HAMSTRINGS'], 'Prone on incline bench, bilateral', 'Adds a supported posterior-chain exercise.')),
  newCandidate('kettlebell-sumo-squat', 'goblet-squat', 'HIGH', 'The wide sumo stance and kettlebell loading materially change the squat emphasis.', ['Kettlebell rather than dumbbell.', 'Wide externally rotated stance increases adductor emphasis.'], proposal('kettlebell-sumo-squat', names('Kettlebell Sumo Squat', 'Приседание сумо с гирей', 'Squat sumo avec kettlebell', '壶铃相扑深蹲'), 'STRENGTH', 'SQUAT', ['KETTLEBELL'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['QUADRICEPS', 'GLUTES', 'ADDUCTORS'], ['HAMSTRINGS'], 'Standing wide stance, bilateral', 'Adds a valid stance-and-equipment-specific squat.')),
  newCandidate('lateral-lunge-stretch', 'hip-flexor-stretch', 'HIGH', 'A lateral lunge stretch targets adductors in a side-to-side stance rather than the hip flexors.', ['Lateral lunge position.', 'Primary adductor and inner-thigh mobility emphasis.'], proposal('lateral-lunge-stretch', names('Lateral Lunge Stretch', 'Растяжка в боковом выпаде', 'Étirement en fente latérale', '侧弓步拉伸'), 'MOBILITY', 'MOBILITY', ['BODYWEIGHT'], ['BEGINNER', 'INTERMEDIATE'], ['ADDUCTORS'], ['GLUTES', 'HAMSTRINGS'], 'Standing lateral lunge, unilateral', 'Adds practical frontal-plane mobility.', true)),
  newCandidate('leg-raise', 'dead-bug', 'HIGH', 'The approved image shows a supine straight-leg raise, emphasizing hip flexion and lower abdominal control rather than dead-bug stability.', ['Straight-leg hip flexion rather than alternating limb stability.', 'Long-lever bilateral movement.'], proposal('lying-leg-raise', names('Lying Leg Raise', 'Подъём ног лёжа', 'Relevé de jambes allongé', '仰卧举腿'), 'STRENGTH', 'CORE_FLEXION', ['BODYWEIGHT'], ['INTERMEDIATE', 'ADVANCED'], ['ABS'], [], 'Supine, bilateral', 'Adds the distinct movement shown in the approved image.', false, ['TargetMuscleGroup has no HIP_FLEXORS value, so the valid metadata captures ABS but cannot represent hip-flexor targeting precisely.'])),
  newCandidate('mini-loop-band-side-lying-hip-abduction', 'hip-abduction-machine', 'HIGH', 'A side-lying unilateral mini-band abduction differs from seated machine abduction.', ['Resistance band rather than machine.', 'Side-lying unilateral execution.'], proposal('mini-loop-band-side-lying-hip-abduction', names('Mini-Band Side-Lying Hip Abduction', 'Отведение бедра лёжа на боку с мини-лентой', 'Abduction de hanche allongée avec mini-bande', '迷你弹力带侧卧髋外展'), 'STRENGTH', 'ISOLATION', ['RESISTANCE_BANDS'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['ABDUCTORS', 'GLUTES'], ['CORE'], 'Side-lying, unilateral', 'Adds a home-friendly banded hip exercise.', true)),
  newCandidate('palms-down-barbell-wrist-curl', 'dumbbell-biceps-curl', 'HIGH', 'A pronated wrist curl isolates wrist extensors and is not an elbow-flexion curl.', ['Wrist movement rather than elbow flexion.', 'Pronated barbell grip rather than dumbbell elbow flexion.'], proposal('palms-down-barbell-wrist-curl', names('Palms-Down Barbell Wrist Curl', 'Разгибание запястий со штангой хватом сверху', 'Flexion des poignets à la barre, paumes vers le bas', '杠铃反握腕弯举'), 'STRENGTH', 'ISOLATION', ['BARBELL'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['FOREARMS'], [], 'Seated or standing, bilateral', 'Adds a direct forearm exercise.')),
  newCandidate('palms-down-dumbbell-wrist-curl', 'dumbbell-biceps-curl', 'HIGH', 'A palms-down wrist curl isolates the forearms rather than flexing the elbow.', ['Wrist extension rather than elbow flexion.', 'Pronated grip and forearm isolation.'], proposal('palms-down-dumbbell-wrist-curl', names('Palms-Down Dumbbell Wrist Curl', 'Разгибание запястий с гантелями хватом сверху', 'Flexion des poignets avec haltères, paumes vers le bas', '哑铃反握腕弯举'), 'STRENGTH', 'ISOLATION', ['DUMBBELLS'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['FOREARMS'], [], 'Seated or standing, bilateral', 'Adds the independent-dumbbell forearm movement.')),
  newCandidate('russian-twist', 'pallof-press', 'HIGH', 'A Russian twist is active trunk rotation; a Pallof press is anti-rotation.', ['ROTATION rather than ANTI_ROTATION.', 'Seated bilateral side-to-side movement rather than standing cable resistance.'], proposal('russian-twist', names('Russian Twist', 'Русский твист', 'Rotation russe', '俄罗斯转体'), 'STRENGTH', 'ROTATION', ['BODYWEIGHT'], ['INTERMEDIATE', 'ADVANCED'], ['OBLIQUES', 'ABS'], ['CORE'], 'Seated, bilateral rotation', 'Adds an active rotational core exercise; both approved files remain media variants of this one identity.')),
  newCandidate('seated-machine-calf-press', 'seated-calf-raise', 'MEDIUM', 'The approved identity denotes calf pressing on a seated resistance machine rather than the existing seated calf-raise apparatus.', ['Different machine setup and load path.', 'Pressing platform execution rather than knee-pad calf raise.'], proposal('seated-machine-calf-press', names('Seated Machine Calf Press', 'Жим носками в тренажёре сидя', 'Presse à mollets assise à la machine', '坐姿器械小腿推举'), 'STRENGTH', 'ISOLATION', ['MACHINES'], ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], ['CALVES'], [], 'Seated, bilateral', 'Adds a distinct machine setup while retaining the current seated calf raise.')),
  newCandidate('single-leg-kickback', 'bird-dog', 'HIGH', 'The approved image shows a quadruped straight-leg glute kickback, not the opposing arm-and-leg stability pattern of bird dog.', ['Single moving leg without contralateral arm reach.', 'Glute isolation emphasis rather than core balance.'], proposal('quadruped-leg-kickback', names('Quadruped Leg Kickback', 'Отведение ноги назад на четвереньках', 'Extension de jambe à quatre pattes', '跪姿单腿后踢'), 'STRENGTH', 'ISOLATION', ['BODYWEIGHT'], ['BEGINNER', 'INTERMEDIATE'], ['GLUTES'], ['HAMSTRINGS', 'CORE'], 'Quadruped, unilateral', 'Uses a precise canonical identity for the approved movement.', true)),
  newCandidate('standing-barbell-calf-raise', 'standing-calf-raise', 'HIGH', 'External barbell loading makes this a distinct advanced progression from the bodyweight exercise.', ['Barbell rather than bodyweight.', 'Greater loading and balance demands.'], proposal('standing-barbell-calf-raise', names('Standing Barbell Calf Raise', 'Подъём на носки стоя со штангой', 'Élévation des mollets debout à la barre', '站姿杠铃提踵'), 'STRENGTH', 'ISOLATION', ['BARBELL'], ['INTERMEDIATE', 'ADVANCED'], ['CALVES'], ['CORE'], 'Standing, bilateral', 'Adds the loaded barbell progression.')),
  newCandidate('standing-hip-abduction', 'hip-abduction-machine', 'HIGH', 'The approved image shows unsupported standing bodyweight hip abduction, distinct from a seated machine.', ['Bodyweight rather than machine.', 'Standing unilateral movement with balance demand.'], proposal('standing-hip-abduction', names('Standing Hip Abduction', 'Отведение бедра стоя', 'Abduction de hanche debout', '站姿髋外展'), 'STRENGTH', 'ISOLATION', ['BODYWEIGHT'], ['BEGINNER', 'INTERMEDIATE'], ['ABDUCTORS', 'GLUTES'], ['CORE'], 'Standing, unilateral', 'Adds an accessible bodyweight hip exercise.', true)),
  newCandidate('stiff-legged-barbell-good-morning', 'romanian-deadlift', 'HIGH', 'A good morning carries the bar on the upper back and hinges the torso; it is not a hand-held Romanian deadlift.', ['Bar rests on upper back rather than hanging from the hands.', 'Long lever and advanced bracing demands.'], proposal('stiff-legged-barbell-good-morning', names('Stiff-Legged Barbell Good Morning', 'Наклон «доброе утро» со штангой на прямых ногах', 'Good morning jambes tendues à la barre', '直腿杠铃早安式'), 'STRENGTH', 'HINGE', ['BARBELL'], ['ADVANCED'], ['HAMSTRINGS', 'GLUTES'], ['LOWER_BACK'], 'Standing, bilateral', 'Adds a technically distinct advanced hinge.')),
  newCandidate('superman', 'bird-dog', 'HIGH', 'Superman is a prone bilateral trunk-and-limb extension; bird dog is quadruped and alternating.', ['Prone bilateral extension rather than quadruped contralateral movement.', 'Greater spinal-extension emphasis.'], proposal('superman', names('Superman', 'Супермен', 'Superman', '超人式'), 'STRENGTH', 'CORE_STABILITY', ['BODYWEIGHT'], ['BEGINNER', 'INTERMEDIATE'], ['LOWER_BACK'], ['GLUTES', 'SHOULDERS'], 'Prone, bilateral', 'Adds a recognized posterior core exercise.')),
  newCandidate('trap-bar-shrugs', 'face-pull', 'HIGH', 'Trap-bar neutral-grip shrugs are a distinct loaded scapular-elevation exercise.', ['Isolation by scapular elevation rather than horizontal cable pulling.', 'Trap-bar neutral grip rather than cable and rope.'], proposal('trap-bar-shrugs', names('Trap-Bar Shrugs', 'Шраги с трэп-грифом', 'Haussements d’épaules à la barre hexagonale', '六角杠铃耸肩'), 'STRENGTH', 'ISOLATION', ['BARBELL'], ['INTERMEDIATE', 'ADVANCED'], ['TRAPS'], ['FOREARMS'], 'Standing, bilateral', 'Adds the approved trap-bar variation.', false, ['ExerciseEquipment has no TRAP_BAR value; BARBELL is the closest valid umbrella equipment value.']))
] as const;

export function buildCatalogAlignmentReport(
  reconciliation: ExerciseMediaReconciliationReport,
  catalog: SeedExercise[]
): ExerciseMediaCatalogAlignmentReport {
  validateRepositoryEnums();
  const catalogBySlug = new Map(catalog.map((exercise) => [exercise.slug, exercise] as const));
  const expected = [...reconciliation.imageSlugsWithoutCatalog].sort();
  const decisionSlugs = ALIGNMENT_DECISIONS.map((item) => item.imageSlug).sort();
  if (new Set(decisionSlugs).size !== decisionSlugs.length || JSON.stringify(expected) !== JSON.stringify(decisionSlugs)) {
    throw new Error(`Alignment coverage mismatch. Expected ${expected.length} reconciliation identities and received ${decisionSlugs.length} decisions.`);
  }

  const items = ALIGNMENT_DECISIONS.map<ExerciseMediaCatalogAlignmentItem>((decision) => {
    const sourceFiles = reconciliation.items
      .filter((item) => item.parsedSlug === decision.imageSlug)
      .map((item) => item.sourceFileName)
      .sort();
    if (!sourceFiles.length) throw new Error(`No reconciliation source files found for ${decision.imageSlug}.`);
    if (decision.existingExerciseSlug && !catalogBySlug.has(decision.existingExerciseSlug)) {
      throw new Error(`Safe existing target ${decision.existingExerciseSlug} does not exist.`);
    }
    if (decision.proposedExercise && catalogBySlug.has(decision.proposedExercise.slug)) {
      throw new Error(`Proposed slug ${decision.proposedExercise.slug} collides with the current catalog.`);
    }
    const closest = decision.closestExerciseSlug ? catalogBySlug.get(decision.closestExerciseSlug) : undefined;
    if (decision.closestExerciseSlug && !closest && !ALIGNMENT_DECISIONS.some((item) => item.proposedExercise?.slug === decision.closestExerciseSlug)) {
      throw new Error(`Closest comparison ${decision.closestExerciseSlug} is not current or proposed.`);
    }
    return {
      imageSlug: decision.imageSlug,
      sourceFiles,
      status: decision.status,
      proposedCanonicalSlug: decision.proposedCanonicalSlug,
      existingExerciseSlug: decision.existingExerciseSlug,
      confidence: decision.confidence,
      reason: decision.reason,
      closestExistingExercise: closest ? catalogComparison(closest) : null,
      differencesFromClosestExercise: [...decision.differencesFromClosestExercise],
      proposedAction: decision.proposedAction,
      proposedExercise: decision.proposedExercise ? materializeProposal(decision.proposedExercise) : null,
      ...(decision.reviewNote ? { reviewNote: decision.reviewNote } : {})
    };
  }).sort((a, b) => a.imageSlug.localeCompare(b.imageSlug));

  const safeAliases = countStatus(items, 'SAFE_ALIAS');
  const proposedNewExercises = countStatus(items, 'NEW_EXERCISE_CANDIDATE');
  const duplicateExercises = countStatus(items, 'DUPLICATE_EXERCISE');
  const excludedMediaIdentities = countStatus(items, 'UNSUPPORTED_MEDIA');
  const ambiguousIdentities = countStatus(items, 'AMBIGUOUS_REVIEW_REQUIRED');
  const existingCovered = new Set(reconciliation.items.filter((item) => item.canonicalSlug && ['EXACT_MATCH', 'ALIAS_MATCH'].includes(item.status)).map((item) => item.canonicalSlug!));
  for (const item of items) {
    if (item.status === 'SAFE_ALIAS' && item.existingExerciseSlug) existingCovered.add(item.existingExerciseSlug);
  }
  const proposedSlugs = items.flatMap((item) => item.proposedExercise ? [item.proposedExercise.slug] : []);
  const projectedMediaCoveredExercises = existingCovered.size + proposedSlugs.length;
  const projectedCatalogSize = catalog.length + proposedSlugs.length;
  const projectedCatalogExercisesWithoutMedia = catalog.map((item) => item.slug).filter((slug) => !existingCovered.has(slug)).sort();

  return {
    schemaVersion: 'exercise-media-catalog-alignment.v1',
    sourceReconciliation: 'apps/mobile/assets/exercise-media/exercise-media-reconciliation.json',
    summary: {
      currentCatalogExercises: catalog.length,
      classifiedUnmatchedIdentities: items.length,
      safeAliases,
      proposedNewExercises,
      duplicateExercises,
      excludedMediaIdentities,
      ambiguousIdentities,
      projectedCatalogSize,
      projectedMediaCoveredExercises,
      remainingCatalogExercisesWithoutMedia: projectedCatalogSize - projectedMediaCoveredExercises
    },
    automaticSafeDecisions: items.filter((item) => item.status === 'SAFE_ALIAS' && item.proposedAction === 'RENAME_FILE').map((item) => item.imageSlug),
    productApprovalDecisions: items.filter((item) => item.status === 'NEW_EXERCISE_CANDIDATE' || item.proposedAction === 'MANUAL_REVIEW').map((item) => item.imageSlug),
    unresolvedAmbiguities: items.filter((item) => item.status === 'AMBIGUOUS_REVIEW_REQUIRED').map((item) => item.imageSlug),
    projectedCatalogExercisesWithoutMedia,
    items
  };
}

export function toCatalogAlignmentMarkdown(report: ExerciseMediaCatalogAlignmentReport) {
  const s = report.summary;
  const decisions = report.items.map((item) => {
    const proposalDetails = item.proposedExercise ? `\n\n**Proposed metadata:** \`${item.proposedExercise.category}\` / \`${item.proposedExercise.movementPattern}\`; equipment ${item.proposedExercise.equipment.join(', ')}; levels ${item.proposedExercise.levels.join(', ')}; primary ${item.proposedExercise.primaryMuscles.join(', ')}; secondary ${item.proposedExercise.secondaryMuscles.join(', ') || 'none'}; ${item.proposedExercise.isUnilateral ? 'unilateral' : 'bilateral'}; active.\n\n**Locale names:** ${SUPPORTED_LOCALES.map((locale) => `${locale}: ${item.proposedExercise!.translations[locale]}`).join('; ')}.${item.proposedExercise.enumLimitations?.length ? `\n\n**Enum limitation:** ${item.proposedExercise.enumLimitations.join(' ')}` : ''}` : '';
    const closest = item.closestExistingExercise ? `\n\n**Closest current exercise:** ${item.closestExistingExercise.canonicalEnglishName} (\`${item.closestExistingExercise.slug}\`) — ${item.closestExistingExercise.category}, ${item.closestExistingExercise.movementPattern}, equipment ${item.closestExistingExercise.equipment.join(', ')}, levels ${item.closestExistingExercise.trainingLevels.join(', ')}, primary ${item.closestExistingExercise.primaryMuscles.join(', ')}, secondary ${item.closestExistingExercise.secondaryMuscles.join(', ') || 'none'}, ${item.closestExistingExercise.unilateralOrBilateral}, ${item.closestExistingExercise.bodyPosition}. ${item.closestExistingExercise.movementDescription}` : '';
    return `### ${item.imageSlug}\n\n- Status: **${item.status}**\n- Confidence: **${item.confidence}**\n- Source: ${item.sourceFiles.map((file) => `\`${file}\``).join(', ')}\n- Proposed canonical slug: ${item.proposedCanonicalSlug ? `\`${item.proposedCanonicalSlug}\`` : 'none'}\n- Existing exercise: ${item.existingExerciseSlug ? `\`${item.existingExerciseSlug}\`` : 'none'}\n- Action after approval: **${item.proposedAction}**\n- Reason: ${item.reason}\n- Material differences: ${item.differencesFromClosestExercise.join(' ')}${item.reviewNote ? `\n- Review note: ${item.reviewNote}` : ''}${closest}${proposalDetails}`;
  }).join('\n\n');
  return `# Exercise media catalog alignment\n\nThis is a deterministic review package. It does not modify the ExerciseLibrary, rename media, write the database, or call OpenAI. Similar target muscles never establish exercise identity; equipment, loading, body position, laterality, range of motion, and technique all matter.\n\n## Strategy\n\nPreserve all 46 canonical exercises and immutable historical references. Add approved distinct exercises, rename only materially identical aliases, and hold ambiguous or unsupported media outside ingestion. Catalog expansion is safer than replacing stable slugs.\n\n## Projected impact\n\n| Metric | Count |\n| --- | ---: |\n| Current catalog exercises | ${s.currentCatalogExercises} |\n| Classified unmatched identities | ${s.classifiedUnmatchedIdentities} |\n| Safe aliases | ${s.safeAliases} |\n| Proposed new exercises | ${s.proposedNewExercises} |\n| Duplicate exercises | ${s.duplicateExercises} |\n| Excluded media identities | ${s.excludedMediaIdentities} |\n| Ambiguous identities | ${s.ambiguousIdentities} |\n| Projected catalog size | ${s.projectedCatalogSize} |\n| Projected media-covered exercises | ${s.projectedMediaCoveredExercises} |\n| Remaining catalog exercises without media | ${s.remainingCatalogExercisesWithoutMedia} |\n\n## Approval boundary\n\nAutomatic safe decisions: ${list(report.automaticSafeDecisions)}.\n\nProduct approval decisions: ${list(report.productApprovalDecisions)}.\n\nUnresolved ambiguities: ${list(report.unresolvedAmbiguities)}.\n\nThe \`hip-thrust\` and \`barbell-hip-thrust\` media identities remain separate: \`hip-thrust_anatomy-01.webp\` stays with the existing Hip Thrust exercise, while \`barbell-hip-thrust_anatomy-01.webp\` is proposed as a new loaded barbell exercise. Russian Twist 01 and 02 are one proposed exercise with two future anatomy media rows: 01 primary/sort 0, 02 secondary/sort 1.\n\n## Remaining catalog exercises without media\n\n${list(report.projectedCatalogExercisesWithoutMedia)}.\n\n## Decisions\n\n${decisions}\n\n## Next batch after approval\n\nApply the approved catalog expansion, apply the remaining safe media aliases, validate every WebP asset, then ingest ExerciseMedia. No execution from this report is automatic.\n`;
}

function materializeProposal(input: ProposedExerciseInput): ProposedExercise {
  return {
    slug: input.slug,
    canonicalEnglishName: input.names['en-US'],
    category: input.category,
    movementPattern: input.movementPattern,
    equipment: [...input.equipment],
    levels: [...input.levels],
    primaryMuscles: [...input.primaryMuscles],
    secondaryMuscles: [...input.secondaryMuscles],
    isUnilateral: input.isUnilateral,
    isActive: true,
    bodyPosition: input.bodyPosition,
    rationale: input.rationale,
    ...(input.enumLimitations ? { enumLimitations: [...input.enumLimitations] } : {}),
    translations: { ...input.names }
  };
}

function catalogComparison(exercise: SeedExercise): ExerciseComparison {
  const english = exercise.translations.find((item) => item.locale === 'en-US');
  const tags = new Set(exercise.contraindicationTags);
  const bodyPosition = tags.has('SUPINE_POSITION') ? 'Supine' : tags.has('PRONE_POSITION') ? 'Prone' : exercise.equipment.includes('BENCH') ? 'Bench-supported or bench-based' : 'Not explicitly modeled in the current seed';
  const unilateralOrBilateral = /one-arm|single|side-plank|reverse-lunge|step-up/i.test(exercise.slug) ? 'Unilateral or alternating' : 'Bilateral or not explicitly modeled';
  return {
    slug: exercise.slug,
    canonicalEnglishName: english?.name ?? exercise.slug,
    category: exercise.category,
    movementPattern: exercise.movementPattern,
    equipment: [...exercise.equipment],
    trainingLevels: [...exercise.trainingLevels],
    primaryMuscles: [...exercise.targetMuscles],
    secondaryMuscles: [...exercise.secondaryMuscles],
    unilateralOrBilateral,
    bodyPosition,
    movementDescription: english?.description ?? 'No English movement description is present.'
  };
}

function validateRepositoryEnums() {
  const sets = {
    category: new Set<string>(EXERCISE_CATEGORIES),
    movement: new Set<string>(MOVEMENT_PATTERNS),
    equipment: new Set<string>(EXERCISE_EQUIPMENT),
    level: new Set<string>(TRAINING_LEVELS),
    muscle: new Set<string>(TARGET_MUSCLE_GROUPS)
  };
  for (const decision of ALIGNMENT_DECISIONS) {
    const item = decision.proposedExercise;
    if (!item) continue;
    const invalid = [
      !sets.category.has(item.category) && item.category,
      !sets.movement.has(item.movementPattern) && item.movementPattern,
      ...item.equipment.filter((value) => !sets.equipment.has(value)),
      ...item.levels.filter((value) => !sets.level.has(value)),
      ...item.primaryMuscles.filter((value) => !sets.muscle.has(value)),
      ...item.secondaryMuscles.filter((value) => !sets.muscle.has(value))
    ].filter(Boolean);
    if (invalid.length) throw new Error(`Invalid repository enum values for ${item.slug}: ${invalid.join(', ')}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) throw new Error(`Invalid proposed canonical slug: ${item.slug}`);
    if (SUPPORTED_LOCALES.some((locale) => !item.names[locale]?.trim())) throw new Error(`Missing proposed locale name for ${item.slug}.`);
  }
}

function countStatus(items: ExerciseMediaCatalogAlignmentItem[], status: AlignmentStatus) {
  return items.filter((item) => item.status === status).length;
}

function list(items: string[]) {
  return items.length ? items.map((item) => `\`${item}\``).join(', ') : 'None';
}
