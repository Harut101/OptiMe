import type { SupportedLocale } from '@optime/shared-types';

export interface SafeFallbackCopy {
  summaryTitle: string;
  summaryMessage: string;
  calorieLabel: string;
  calorieNotes: string;
  protein: string;
  carbs: string;
  fat: string;
  macroNotes: string;
  mealName: string;
  mealPurpose: string;
  proteinFood: string;
  proteinNotes: string;
  produceFood: string;
  simpleNotes: string;
  hydrationGuidance: string;
  hydrationNotes: string;
  trainingRecommendation: string;
  trainingNotes: string;
  recoveryRecommendation: string;
  sleepTip: string;
  mobilityTip: string;
  reminders: string[];
  trainingOffRecommendation: string;
  trainingOffNotes: string;
}

const COPY: Record<SupportedLocale, SafeFallbackCopy> = {
  'en-US': {
    summaryTitle: 'Simple safe plan', summaryMessage: 'Here is a simple, supportive plan for today.', calorieLabel: 'Balanced guidance', calorieNotes: 'A balanced target for steady energy today.', protein: 'Include a familiar protein option', carbs: 'Add steady-energy carbs if training or energy calls for it', fat: 'Include satisfying fats in moderate portions', macroNotes: 'Keep this flexible and comfortable.', mealName: 'Balanced meal', mealPurpose: 'Steady energy', proteinFood: 'A familiar protein option', proteinNotes: 'Choose something that fits your allergies and preferences.', produceFood: 'Fruit or vegetables', simpleNotes: 'Keep it simple and comfortable.', hydrationGuidance: 'Drink regularly across the day.', hydrationNotes: 'Hydration supports energy and recovery.', trainingRecommendation: 'Choose light to moderate movement that feels manageable.', trainingNotes: 'If you feel unwell, dizzy, exhausted, or in pain, prioritize rest.', recoveryRecommendation: 'Focus on consistency, hydration, and rest.', sleepTip: 'Protect a calm evening routine if possible.', mobilityTip: 'Gentle mobility is enough today.', reminders: ['Eat regular meals', 'Stay hydrated', 'Give yourself enough recovery time'], trainingOffRecommendation: 'Training is off for this plan.', trainingOffNotes: 'OptiMe will focus on nutrition today. You can enable training whenever it fits your goals.'
  },
  'ru-RU': {
    summaryTitle: 'Простой безопасный план', summaryMessage: 'Вот простой и поддерживающий план на сегодня.', calorieLabel: 'Сбалансированный ориентир', calorieNotes: 'Сбалансированный ориентир для стабильной энергии сегодня.', protein: 'Добавьте привычный источник белка', carbs: 'Добавьте углеводы для стабильной энергии, если этого требует тренировка или самочувствие', fat: 'Добавляйте сытные жиры умеренно', macroNotes: 'Оставьте план гибким и комфортным.', mealName: 'Сбалансированный приём пищи', mealPurpose: 'Стабильная энергия', proteinFood: 'Привычный источник белка', proteinNotes: 'Выберите вариант с учётом аллергий и предпочтений.', produceFood: 'Фрукты или овощи', simpleNotes: 'Пусть это будет просто и комфортно.', hydrationGuidance: 'Пейте регулярно в течение дня.', hydrationNotes: 'Вода поддерживает энергию и восстановление.', trainingRecommendation: 'Выберите лёгкое или умеренное движение, которое ощущается посильным.', trainingNotes: 'При недомогании, головокружении, сильной усталости или боли отдайте приоритет отдыху.', recoveryRecommendation: 'Сделайте акцент на регулярности, воде и отдыхе.', sleepTip: 'По возможности сохраните спокойный вечерний ритуал.', mobilityTip: 'Сегодня достаточно мягкой подвижности.', reminders: ['Ешьте регулярно', 'Пейте воду', 'Оставьте достаточно времени на восстановление'], trainingOffRecommendation: 'Тренировка не запланирована для этого плана.', trainingOffNotes: 'Сегодня OptiMe сосредоточится на питании. Вы сможете включить тренировки, когда это будет соответствовать вашим целям.'
  },
  'fr-FR': {
    summaryTitle: 'Plan simple et prudent', summaryMessage: "Voici un plan simple et bienveillant pour aujourd'hui.", calorieLabel: 'Repere equilibre', calorieNotes: "Un repere equilibre pour une energie stable aujourd'hui.", protein: 'Ajoutez une source de proteines familiere', carbs: "Ajoutez des glucides pour une energie stable selon l'entrainement ou vos sensations", fat: 'Ajoutez des lipides rassasiants avec moderation', macroNotes: 'Gardez ce plan souple et confortable.', mealName: 'Repas equilibre', mealPurpose: 'Energie stable', proteinFood: 'Une source de proteines familiere', proteinNotes: 'Choisissez selon vos allergies et preferences.', produceFood: 'Fruits ou legumes', simpleNotes: 'Gardez cela simple et confortable.', hydrationGuidance: 'Buvez regulierement pendant la journee.', hydrationNotes: "L'hydratation soutient l'energie et la recuperation.", trainingRecommendation: 'Choisissez un mouvement leger a modere qui vous semble accessible.', trainingNotes: 'En cas de malaise, vertige, epuisement ou douleur, privilegiez le repos.', recoveryRecommendation: "Misez sur la regularite, l'hydratation et le repos.", sleepTip: 'Gardez une routine du soir calme si possible.', mobilityTip: 'Une mobilite douce suffit aujourd’hui.', reminders: ['Mangez regulierement', 'Hydratez-vous', 'Laissez assez de temps pour recuperer'], trainingOffRecommendation: "L'entrainement est desactive pour ce plan.", trainingOffNotes: "OptiMe se concentre sur la nutrition aujourd'hui. Vous pourrez activer l'entrainement quand cela conviendra a vos objectifs."
  },
  'zh-CN': {
    summaryTitle: '简单安全计划', summaryMessage: '这是今天简单、支持性的计划。', calorieLabel: '均衡建议', calorieNotes: '今天以稳定能量为目标的均衡建议。', protein: '加入熟悉的蛋白质来源', carbs: '根据训练或能量需要加入稳定供能的碳水', fat: '适量加入有饱腹感的脂肪', macroNotes: '保持灵活和舒适即可。', mealName: '均衡一餐', mealPurpose: '稳定能量', proteinFood: '熟悉的蛋白质来源', proteinNotes: '请选择符合过敏和偏好的食物。', produceFood: '水果或蔬菜', simpleNotes: '保持简单和舒适。', hydrationGuidance: '全天规律饮水。', hydrationNotes: '补水有助于能量和恢复。', trainingRecommendation: '选择自己感觉可承受的轻到中等活动。', trainingNotes: '如感到不适、头晕、极度疲劳或疼痛，请优先休息。', recoveryRecommendation: '关注规律、补水和休息。', sleepTip: '如有可能，保持平静的晚间习惯。', mobilityTip: '今天温和活动就足够了。', reminders: ['规律进餐', '保持补水', '留出足够恢复时间'], trainingOffRecommendation: '此计划不安排训练。', trainingOffNotes: 'OptiMe 今天会专注于营养。您可以在符合目标时开启训练。'
  }
};

export function getSafeFallbackCopy(locale: SupportedLocale): SafeFallbackCopy {
  return COPY[locale];
}
