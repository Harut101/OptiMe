import type {
  FoodIngredientMeasurementState,
  FoodIngredientRole,
  SupportedLocale
} from '@optime/shared-types';

import type {
  FoodCatalogCandidate,
  FoodCatalogSelectionRole
} from './food-catalog.types';

export interface FoodIngredientClarity {
  role: FoodIngredientRole;
  measurementState: FoodIngredientMeasurementState;
  preparation: string | null;
  usage: string;
}

/**
 * Ingredient purpose comes from the deterministic recipe role. The model may
 * improve recipe copy, but it never decides whether a catalog food is a main,
 * base, side, or cooking fat.
 */
export function createFoodIngredientClarity(input: {
  candidate: FoodCatalogCandidate;
  selectionRole: FoodCatalogSelectionRole;
  locale: SupportedLocale;
}): FoodIngredientClarity {
  const role = resolveIngredientRole(
    input.selectionRole,
    input.candidate
  );
  const measurementState = resolveMeasurementState(
    input.candidate
  );
  const copy = CLARITY_COPY[input.locale];

  return {
    role,
    measurementState,
    preparation: copy.preparation[measurementState],
    usage: copy.usage[role]
  };
}

export function refreshFoodIngredientClarity(input: {
  candidate: FoodCatalogCandidate;
  existingRole?: FoodIngredientRole;
  locale: SupportedLocale;
}): FoodIngredientClarity {
  const role = resolveReplacementRole(
    input.candidate,
    input.existingRole
  );
  const measurementState = resolveMeasurementState(
    input.candidate
  );
  const copy = CLARITY_COPY[input.locale];

  return {
    role,
    measurementState,
    preparation: copy.preparation[measurementState],
    usage: copy.usage[role]
  };
}

function resolveIngredientRole(
  selectionRole: FoodCatalogSelectionRole,
  candidate: FoodCatalogCandidate
): FoodIngredientRole {
  if (selectionRole === 'MAIN_PROTEIN') return 'MAIN';
  if (
    selectionRole === 'BREAKFAST_BASE' ||
    selectionRole === 'CARBOHYDRATE'
  ) {
    return 'BASE';
  }
  if (selectionRole === 'FAT') {
    return isCookingFat(candidate) ? 'COOKING_FAT' : 'SIDE';
  }
  return 'SIDE';
}

function resolveMeasurementState(
  candidate: FoodCatalogCandidate
): FoodIngredientMeasurementState {
  const searchable = [
    candidate.slug,
    candidate.name,
    ...candidate.aliases
  ]
    .join(' ')
    .toLowerCase();

  if (
    /\b(cooked|boiled|baked|roasted|steamed|grilled|prepared)\b/.test(
      searchable
    ) ||
    /(вар[её]н|готов|запеч|жарен|cuit|cuite|bouilli|grill[ée]|熟|煮|烤)/i.test(
      searchable
    )
  ) {
    return 'COOKED';
  }
  if (/\braw\b/.test(searchable) || /сыр(ой|ая|ое)|cru|crue|生/i.test(searchable)) {
    return 'RAW';
  }
  if (candidate.preparationLevel === 'READY_TO_EAT') {
    return 'READY_TO_EAT';
  }
  return 'AS_LISTED';
}

function resolveReplacementRole(
  candidate: FoodCatalogCandidate,
  existingRole?: FoodIngredientRole
): FoodIngredientRole {
  if (candidate.category === 'FAT') {
    return isCookingFat(candidate) ? 'COOKING_FAT' : 'SIDE';
  }
  return existingRole ?? 'SIDE';
}

function isCookingFat(candidate: FoodCatalogCandidate) {
  const searchable = [
    candidate.slug,
    candidate.name,
    ...candidate.aliases
  ]
    .join(' ')
    .toLowerCase();
  return /\b(oil|butter|ghee)\b|масл|beurre|huile|油|黄油/i.test(
    searchable
  );
}

const CLARITY_COPY: Record<
  SupportedLocale,
  {
    preparation: Record<
      FoodIngredientMeasurementState,
      string | null
    >;
    usage: Record<FoodIngredientRole, string>;
  }
> = {
  'en-US': {
    preparation: {
      RAW: 'Measure before cooking.',
      COOKED: 'Measure after cooking.',
      READY_TO_EAT: 'Measure as served.',
      AS_LISTED: 'Measure in the form named above.'
    },
    usage: {
      MAIN: 'Use as the main component of this meal.',
      BASE: 'Use as the meal base and combine with the other ingredients.',
      SIDE: 'Serve alongside or combine as described in the preparation steps.',
      COOKING_FAT: 'Use the measured amount during cooking or as dressing; it is included in the nutrition totals.',
      DRESSING: 'Use the measured amount as the dressing.',
      SEASONING: 'Use to season the meal.',
      GARNISH: 'Add at the end as a garnish.'
    }
  },
  'ru-RU': {
    preparation: {
      RAW: 'Взвесьте до приготовления.',
      COOKED: 'Взвесьте после приготовления.',
      READY_TO_EAT: 'Взвесьте в готовом к подаче виде.',
      AS_LISTED: 'Измеряйте продукт в указанном выше виде.'
    },
    usage: {
      MAIN: 'Используйте как основной компонент блюда.',
      BASE: 'Используйте как основу блюда и соедините с остальными ингредиентами.',
      SIDE: 'Подайте рядом или добавьте по инструкции приготовления.',
      COOKING_FAT: 'Используйте указанное количество при приготовлении или как заправку; оно уже учтено в пищевой ценности.',
      DRESSING: 'Используйте указанное количество как заправку.',
      SEASONING: 'Используйте для приправы блюда.',
      GARNISH: 'Добавьте в конце как украшение.'
    }
  },
  'fr-FR': {
    preparation: {
      RAW: 'Mesurez avant la cuisson.',
      COOKED: 'Mesurez après la cuisson.',
      READY_TO_EAT: 'Mesurez au moment de servir.',
      AS_LISTED: 'Mesurez dans la forme indiquée ci-dessus.'
    },
    usage: {
      MAIN: 'Utilisez comme composant principal de ce repas.',
      BASE: 'Utilisez comme base du repas avec les autres ingrédients.',
      SIDE: 'Servez à côté ou combinez selon les étapes de préparation.',
      COOKING_FAT: 'Utilisez la quantité indiquée pour la cuisson ou comme assaisonnement ; elle est incluse dans les valeurs nutritionnelles.',
      DRESSING: 'Utilisez la quantité indiquée comme assaisonnement.',
      SEASONING: 'Utilisez pour assaisonner le repas.',
      GARNISH: 'Ajoutez à la fin comme garniture.'
    }
  },
  'zh-CN': {
    preparation: {
      RAW: '烹饪前称量。',
      COOKED: '烹饪后称量。',
      READY_TO_EAT: '按上桌时的状态称量。',
      AS_LISTED: '按上方所列状态称量。'
    },
    usage: {
      MAIN: '作为本餐的主要组成部分。',
      BASE: '作为本餐的基础，与其他食材搭配。',
      SIDE: '作为配菜，或按烹饪步骤与其他食材组合。',
      COOKING_FAT: '按标示用量用于烹饪或调味；该用量已计入营养总量。',
      DRESSING: '按标示用量作为调味汁。',
      SEASONING: '用于给餐食调味。',
      GARNISH: '最后加入作为点缀。'
    }
  }
};
