import { ProgressiveProfilePromptKey } from '@prisma/client';

export type ProgressivePromptInputType =
  | 'stringList'
  | 'singleSelect'
  | 'multiSelect'
  | 'number';

export type ProgressivePromptDefinition = {
  key: ProgressiveProfilePromptKey;
  title: string;
  description: string;
  inputType: ProgressivePromptInputType;
  options?: Array<{ label: string; value: string }>;
};

export const progressivePromptDefinitions: ProgressivePromptDefinition[] = [
  {
    key: ProgressiveProfilePromptKey.EXCLUDED_FOODS,
    title: 'Any foods you prefer to avoid?',
    description: 'We will keep these out of regular suggestions when possible.',
    inputType: 'stringList'
  },
  {
    key: ProgressiveProfilePromptKey.PREFERRED_FOODS,
    title: 'Any foods you want us to use more often?',
    description: 'A few favorites help future meals feel easier and more familiar.',
    inputType: 'stringList'
  },
  {
    key: ProgressiveProfilePromptKey.LIMITATIONS_OR_PAIN_AREAS,
    title: 'Any pain or limitations we should respect?',
    description: 'Share anything that should keep training guidance gentler or more careful.',
    inputType: 'stringList'
  },
  {
    key: ProgressiveProfilePromptKey.EQUIPMENT,
    title: 'What equipment do you usually have?',
    description: 'This helps future exercise suggestions fit your real setup.',
    inputType: 'multiSelect',
    options: [
      { label: 'Gym', value: 'GYM' },
      { label: 'Home', value: 'HOME' },
      { label: 'Dumbbells', value: 'DUMBBELLS' },
      { label: 'Bodyweight', value: 'BODYWEIGHT' },
      { label: 'Machines', value: 'MACHINES' }
    ]
  },
  {
    key: ProgressiveProfilePromptKey.TRAINING_LEVEL,
    title: 'What is your training level?',
    description: 'This helps keep future exercise guidance realistic.',
    inputType: 'singleSelect',
    options: [
      { label: 'Beginner', value: 'BEGINNER' },
      { label: 'Intermediate', value: 'INTERMEDIATE' },
      { label: 'Advanced', value: 'ADVANCED' }
    ]
  },
  {
    key: ProgressiveProfilePromptKey.TARGET_MUSCLE_GROUPS,
    title: 'Any body areas you want to improve?',
    description: 'This will help future training suggestions feel more targeted.',
    inputType: 'multiSelect',
    options: [
      { label: 'Core', value: 'CORE' },
      { label: 'Glutes', value: 'GLUTES' },
      { label: 'Legs', value: 'LEGS' },
      { label: 'Back', value: 'BACK' },
      { label: 'Chest', value: 'CHEST' },
      { label: 'Shoulders', value: 'SHOULDERS' },
      { label: 'Arms', value: 'ARMS' }
    ]
  },
  {
    key: ProgressiveProfilePromptKey.COOKING_TIME,
    title: 'How much cooking time usually fits?',
    description: 'This will help future meals match your day.',
    inputType: 'singleSelect',
    options: [
      { label: 'Very quick', value: 'VERY_QUICK' },
      { label: '15-30 minutes', value: 'FIFTEEN_TO_THIRTY' },
      { label: 'I can cook longer', value: 'LONGER' }
    ]
  },
  {
    key: ProgressiveProfilePromptKey.MEAL_PREP,
    title: 'How do you like to prep meals?',
    description: 'This will help future plans feel more practical.',
    inputType: 'singleSelect',
    options: [
      { label: 'Fresh each meal', value: 'FRESH' },
      { label: 'Batch prep', value: 'BATCH_PREP' },
      { label: 'Mix of both', value: 'MIXED' }
    ]
  },
  {
    key: ProgressiveProfilePromptKey.MEAL_TIMING,
    title: 'Any meal timing preference?',
    description: 'This can help future plans work around training and your daily rhythm.',
    inputType: 'singleSelect',
    options: [
      { label: 'Earlier meals', value: 'EARLIER' },
      { label: 'Evenly spaced', value: 'EVENLY_SPACED' },
      { label: 'Later meals', value: 'LATER' },
      { label: 'Flexible', value: 'FLEXIBLE' }
    ]
  },
  {
    key: ProgressiveProfilePromptKey.DIET_TYPE,
    title: 'Do you follow a diet style?',
    description: 'Optional. This helps future meal suggestions fit your preferences.',
    inputType: 'singleSelect',
    options: [
      { label: 'No specific style', value: 'NONE' },
      { label: 'Omnivore', value: 'OMNIVORE' },
      { label: 'Vegetarian', value: 'VEGETARIAN' },
      { label: 'Vegan', value: 'VEGAN' },
      { label: 'Pescatarian', value: 'PESCATARIAN' },
      { label: 'Mediterranean', value: 'MEDITERRANEAN' },
      { label: 'Halal', value: 'HALAL' },
      { label: 'Kosher', value: 'KOSHER' }
    ]
  },
  {
    key: ProgressiveProfilePromptKey.MEALS_PER_DAY,
    title: 'How many meals usually fits your day?',
    description: 'This helps future nutrition guidance match your routine.',
    inputType: 'number'
  },
  {
    key: ProgressiveProfilePromptKey.TRAINING_OUTCOME,
    title: 'What do you want training to emphasize?',
    description: 'This will help future recommendations lean toward the right style.',
    inputType: 'singleSelect',
    options: [
      { label: 'Strength', value: 'STRENGTH' },
      { label: 'Muscle growth', value: 'MUSCLE_GROWTH' },
      { label: 'Endurance', value: 'ENDURANCE' },
      { label: 'Mobility', value: 'MOBILITY' },
      { label: 'General fitness', value: 'GENERAL_FITNESS' }
    ]
  }
];

export function getProgressivePromptDefinition(key: ProgressiveProfilePromptKey) {
  return progressivePromptDefinitions.find((prompt) => prompt.key === key);
}
