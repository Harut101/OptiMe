import { SUPPORTED_LOCALES, type ExerciseCategory, type SupportedLocale } from '@optime/shared-types';
import type { SeedExerciseInput, SeedTranslation } from './types';

export const names = (en: string, ru: string, fr: string, zh: string): SeedExerciseInput['names'] => ({ 'en-US': en, 'ru-RU': ru, 'fr-FR': fr, 'zh-CN': zh });

export function entry(
  slug: string,
  names: SeedExerciseInput['names'],
  category: SeedExerciseInput['category'],
  movementPattern: SeedExerciseInput['movementPattern'],
  equipment: SeedExerciseInput['equipment'],
  targetMuscles: SeedExerciseInput['targetMuscles'],
  secondaryMuscles: SeedExerciseInput['secondaryMuscles'] = [],
  trainingLevels: SeedExerciseInput['trainingLevels'] = ['BEGINNER', 'INTERMEDIATE'],
  contraindicationTags: SeedExerciseInput['contraindicationTags'] = []
): SeedExerciseInput {
  return { slug, names, category, movementPattern, equipment, targetMuscles, secondaryMuscles, trainingLevels, contraindicationTags };
}

export function translationsFor(input: SeedExerciseInput): SeedTranslation[] {
  return SUPPORTED_LOCALES.map((locale) => localizedContent(locale, input.names[locale], input.category));
}

function localizedContent(locale: SupportedLocale, name: string, category: ExerciseCategory): SeedTranslation {
  const templates = CONTENT[locale][category];
  return {
    locale,
    name,
    description: templates.description.replace('{{name}}', name),
    instructions: templates.instructions.map((item) => item.replace('{{name}}', name)),
    coachingCues: [...templates.coachingCues],
    safetyNotes: [...templates.safetyNotes]
  };
}

type ContentTemplate = { description: string; instructions: string[]; coachingCues: string[]; safetyNotes: string[] };
const CONTENT: Record<SupportedLocale, Record<ExerciseCategory, ContentTemplate>> = {
  'en-US': {
    STRENGTH: { description: '{{name}} is a controlled strength exercise for building practical movement capacity.', instructions: ['Set up in a stable position for {{name}}.', 'Move through a comfortable range with steady control.', 'Return to the start position without rushing.'], coachingCues: ['Keep your breathing steady.', 'Use a load you can control.'], safetyNotes: ['Stop if the movement causes pain.', 'Reduce the load or range if control is lost.'] },
    MOBILITY: { description: '{{name}} is a gentle mobility exercise for comfortable, controlled movement.', instructions: ['Set up comfortably for {{name}}.', 'Move slowly through a pain-free range.', 'Pause briefly, then return with control.'], coachingCues: ['Keep the movement smooth.', 'Breathe without holding your breath.'], safetyNotes: ['Do not force the range of motion.', 'Stop if the movement causes pain or dizziness.'] },
    CARDIO: { description: '{{name}} is a steady cardio activity that can be adjusted to your current energy.', instructions: ['Begin {{name}} at an easy pace.', 'Settle into a rhythm where breathing stays controlled.', 'Slow down gradually before stopping.'], coachingCues: ['Choose a sustainable pace.', 'Keep posture relaxed and steady.'], safetyNotes: ['Reduce intensity if you feel unusually exhausted.', 'Stop for pain, dizziness, or illness symptoms.'] },
    RECOVERY: { description: '{{name}} is a low-intensity recovery movement for a calm, comfortable session.', instructions: ['Find a supported position for {{name}}.', 'Move or hold gently while breathing steadily.', 'Finish slowly and return to a comfortable position.'], coachingCues: ['Let the effort stay easy.', 'Use support whenever it improves comfort.'], safetyNotes: ['Avoid forcing uncomfortable positions.', 'Stop if symptoms worsen.'] }
  },
  'ru-RU': {
    STRENGTH: { description: '{{name}} — контролируемое силовое упражнение для развития практичной двигательной силы.', instructions: ['Займите устойчивое исходное положение для упражнения «{{name}}».', 'Двигайтесь в комфортной амплитуде и сохраняйте контроль.', 'Без спешки вернитесь в исходное положение.'], coachingCues: ['Дышите ровно.', 'Используйте вес, который можете контролировать.'], safetyNotes: ['Остановитесь, если движение вызывает боль.', 'Уменьшите вес или амплитуду при потере контроля.'] },
    MOBILITY: { description: '{{name}} — мягкое упражнение для подвижности и комфортного контролируемого движения.', instructions: ['Удобно подготовьтесь к упражнению «{{name}}».', 'Двигайтесь медленно в безболезненной амплитуде.', 'Ненадолго задержитесь и плавно вернитесь.'], coachingCues: ['Двигайтесь плавно.', 'Дышите свободно, не задерживая дыхание.'], safetyNotes: ['Не увеличивайте амплитуду через силу.', 'Остановитесь при боли или головокружении.'] },
    CARDIO: { description: '{{name}} — равномерная кардионагрузка, которую можно подстроить под текущий уровень энергии.', instructions: ['Начните «{{name}}» в лёгком темпе.', 'Найдите ритм с контролируемым дыханием.', 'Перед остановкой постепенно снизьте темп.'], coachingCues: ['Выбирайте устойчивый темп.', 'Сохраняйте расслабленную устойчивую осанку.'], safetyNotes: ['Снизьте интенсивность при необычной усталости.', 'Остановитесь при боли, головокружении или признаках болезни.'] },
    RECOVERY: { description: '{{name}} — спокойное восстановительное движение с низкой интенсивностью.', instructions: ['Примите устойчивое положение для упражнения «{{name}}».', 'Двигайтесь или удерживайте положение мягко и дышите ровно.', 'Завершите медленно и вернитесь в удобное положение.'], coachingCues: ['Сохраняйте лёгкое усилие.', 'Используйте опору, если так комфортнее.'], safetyNotes: ['Не удерживайте неудобное положение через силу.', 'Остановитесь, если самочувствие ухудшается.'] }
  },
  'fr-FR': {
    STRENGTH: { description: '{{name}} est un exercice de renforcement contrôlé qui développe une capacité de mouvement pratique.', instructions: ['Adoptez une position stable pour {{name}}.', 'Travaillez dans une amplitude confortable avec un contrôle régulier.', 'Revenez à la position initiale sans précipitation.'], coachingCues: ['Gardez une respiration régulière.', 'Utilisez une charge que vous maîtrisez.'], safetyNotes: ['Arrêtez si le mouvement provoque une douleur.', 'Réduisez la charge ou l’amplitude si vous perdez le contrôle.'] },
    MOBILITY: { description: '{{name}} est un exercice de mobilité doux favorisant un mouvement confortable et contrôlé.', instructions: ['Installez-vous confortablement pour {{name}}.', 'Bougez lentement dans une amplitude sans douleur.', 'Marquez une courte pause puis revenez avec contrôle.'], coachingCues: ['Gardez un mouvement fluide.', 'Respirez sans bloquer votre souffle.'], safetyNotes: ['Ne forcez pas l’amplitude.', 'Arrêtez en cas de douleur ou de vertige.'] },
    CARDIO: { description: '{{name}} est une activité cardio régulière adaptable à votre énergie du moment.', instructions: ['Commencez {{name}} à une allure facile.', 'Trouvez un rythme où la respiration reste contrôlée.', 'Ralentissez progressivement avant de vous arrêter.'], coachingCues: ['Choisissez une allure durable.', 'Gardez une posture détendue et stable.'], safetyNotes: ['Réduisez l’intensité en cas de fatigue inhabituelle.', 'Arrêtez en cas de douleur, de vertige ou de symptômes de maladie.'] },
    RECOVERY: { description: '{{name}} est un mouvement de récupération de faible intensité pour une séance calme.', instructions: ['Trouvez une position stable pour {{name}}.', 'Bougez ou maintenez doucement la position en respirant régulièrement.', 'Terminez lentement et revenez dans une position confortable.'], coachingCues: ['Gardez un effort léger.', 'Utilisez un appui si cela améliore votre confort.'], safetyNotes: ['Ne forcez pas une position inconfortable.', 'Arrêtez si les symptômes s’aggravent.'] }
  },
  'zh-CN': {
    STRENGTH: { description: '{{name}}是一项强调控制的力量动作，用于提升实用运动能力。', instructions: ['为{{name}}调整到稳定的起始姿势。', '在舒适范围内保持平稳控制。', '不要急促，受控地回到起始位置。'], coachingCues: ['保持均匀呼吸。', '选择能够稳定控制的负重。'], safetyNotes: ['如果动作引起疼痛，请停止。', '无法保持控制时，请降低负重或缩小幅度。'] },
    MOBILITY: { description: '{{name}}是一项温和的灵活性动作，帮助舒适、受控地活动。', instructions: ['以舒适姿势准备{{name}}。', '在无痛范围内缓慢移动。', '短暂停留后，受控地返回。'], coachingCues: ['保持动作流畅。', '自然呼吸，不要憋气。'], safetyNotes: ['不要强行扩大活动范围。', '出现疼痛或头晕时请停止。'] },
    CARDIO: { description: '{{name}}是一项稳定的有氧活动，可根据当天精力调整。', instructions: ['以轻松节奏开始{{name}}。', '找到呼吸可控的稳定节奏。', '结束前逐渐降低速度。'], coachingCues: ['选择可以持续的节奏。', '保持放松而稳定的姿势。'], safetyNotes: ['感到异常疲惫时请降低强度。', '出现疼痛、头晕或生病症状时请停止。'] },
    RECOVERY: { description: '{{name}}是一项低强度恢复动作，适合平静舒适地练习。', instructions: ['为{{name}}找到有支撑的姿势。', '保持均匀呼吸，轻柔移动或停留。', '缓慢结束并回到舒适姿势。'], coachingCues: ['保持轻松的用力程度。', '需要时使用稳定支撑。'], safetyNotes: ['不要强迫身体保持不舒适的姿势。', '如果不适加重，请停止。'] }
  }
};
