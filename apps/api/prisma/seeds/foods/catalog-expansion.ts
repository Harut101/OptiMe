import { DietType, FoodCatalogCategory, FoodRestrictionTag } from '@prisma/client';

import type { SeedFoodCatalogItem } from './types';

const PLANT_BASED = [
  DietType.OMNIVORE,
  DietType.VEGETARIAN,
  DietType.VEGAN,
  DietType.PESCATARIAN,
  DietType.MEDITERRANEAN
];

const VEGETARIAN = [
  DietType.OMNIVORE,
  DietType.VEGETARIAN,
  DietType.PESCATARIAN,
  DietType.MEDITERRANEAN
];

type LocalizedNames = [string, string, string, string];

function food(
  slug: string,
  category: FoodCatalogCategory,
  nutrition: [number, number, number, number, number],
  dietTypes: DietType[],
  sortOrder: number,
  names: LocalizedNames,
  restrictionTags: FoodRestrictionTag[] = []
): SeedFoodCatalogItem {
  const [caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g] = nutrition;
  return {
    slug,
    category,
    caloriesPer100g,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
    fiberPer100g,
    dietTypes,
    restrictionTags,
    sortOrder,
    translations: [
      { locale: 'en-US', name: names[0], aliases: [] },
      { locale: 'ru-RU', name: names[1], aliases: [] },
      { locale: 'fr-FR', name: names[2], aliases: [] },
      { locale: 'zh-CN', name: names[3], aliases: [] }
    ]
  };
}

// The first curated expansion deliberately favors ordinary, broadly available foods.
// Nutrition values are per 100 g and are recalculated by the backend for every portion.
export const foodCatalogExpansion: SeedFoodCatalogItem[] = [
  food('turkey-breast-cooked', FoodCatalogCategory.PROTEIN, [135, 29, 0, 1.6, 0], [DietType.OMNIVORE], 250, ['Cooked turkey breast', 'Готовая грудка индейки', 'Blanc de dinde cuit', '熟火鸡胸肉']),
  food('lean-beef-cooked', FoodCatalogCategory.PROTEIN, [217, 26, 0, 12, 0], [DietType.OMNIVORE], 260, ['Lean cooked beef', 'Постная говядина', 'Boeuf maigre cuit', '熟瘦牛肉']),
  food('canned-tuna-in-water', FoodCatalogCategory.PROTEIN, [116, 25.5, 0, 0.8, 0], [DietType.OMNIVORE, DietType.PESCATARIAN, DietType.MEDITERRANEAN], 270, ['Tuna in water', 'Тунец в собственном соку', 'Thon au naturel', '水浸金枪鱼'], [FoodRestrictionTag.FISH]),
  food('cod-cooked', FoodCatalogCategory.PROTEIN, [105, 23, 0, 0.9, 0], [DietType.OMNIVORE, DietType.PESCATARIAN, DietType.MEDITERRANEAN], 280, ['Cooked cod', 'Готовая треска', 'Cabillaud cuit', '熟鳕鱼'], [FoodRestrictionTag.FISH]),
  food('shrimp-cooked', FoodCatalogCategory.PROTEIN, [99, 24, 0.2, 0.3, 0], [DietType.OMNIVORE, DietType.PESCATARIAN, DietType.MEDITERRANEAN], 290, ['Cooked shrimp', 'Готовые креветки', 'Crevettes cuites', '熟虾'], [FoodRestrictionTag.SHELLFISH]),
  food('tempeh', FoodCatalogCategory.PROTEIN, [193, 19.9, 7.6, 11, 4.4], PLANT_BASED, 300, ['Tempeh', 'Темпе', 'Tempeh', '天贝'], [FoodRestrictionTag.SOY]),

  food('black-beans-cooked', FoodCatalogCategory.LEGUME, [132, 8.9, 23.7, 0.5, 8.7], PLANT_BASED, 310, ['Cooked black beans', 'Варёная чёрная фасоль', 'Haricots noirs cuits', '熟黑豆']),
  food('kidney-beans-cooked', FoodCatalogCategory.LEGUME, [127, 8.7, 22.8, 0.5, 6.4], PLANT_BASED, 320, ['Cooked kidney beans', 'Варёная красная фасоль', 'Haricots rouges cuits', '熟红腰豆']),
  food('edamame-cooked', FoodCatalogCategory.LEGUME, [121, 11.9, 8.9, 5.2, 5.2], PLANT_BASED, 330, ['Cooked edamame', 'Варёные бобы эдамаме', 'Edamame cuit', '熟毛豆'], [FoodRestrictionTag.SOY]),
  food('green-peas-cooked', FoodCatalogCategory.LEGUME, [84, 5.4, 15.6, 0.2, 5.5], PLANT_BASED, 340, ['Cooked green peas', 'Варёный зелёный горошек', 'Petits pois cuits', '熟青豌豆']),
  food('hummus', FoodCatalogCategory.LEGUME, [166, 7.9, 14.3, 9.6, 6], PLANT_BASED, 350, ['Hummus', 'Хумус', 'Houmous', '鹰嘴豆泥']),

  food('white-rice-cooked', FoodCatalogCategory.GRAIN, [130, 2.4, 28.2, 0.3, 0.4], PLANT_BASED, 360, ['Cooked white rice', 'Варёный белый рис', 'Riz blanc cuit', '熟白米饭']),
  food('couscous-cooked', FoodCatalogCategory.GRAIN, [112, 3.8, 23.2, 0.2, 1.4], PLANT_BASED, 370, ['Cooked couscous', 'Варёный кускус', 'Couscous cuit', '熟蒸粗麦粉'], [FoodRestrictionTag.WHEAT, FoodRestrictionTag.GLUTEN]),
  food('whole-wheat-pasta-cooked', FoodCatalogCategory.GRAIN, [149, 5.8, 30.1, 1.1, 3.9], PLANT_BASED, 380, ['Cooked whole-wheat pasta', 'Цельнозерновая паста', 'Pâtes complètes cuites', '熟全麦意面'], [FoodRestrictionTag.WHEAT, FoodRestrictionTag.GLUTEN]),
  food('pasta-cooked', FoodCatalogCategory.GRAIN, [157, 5.8, 30.9, 0.9, 1.8], PLANT_BASED, 390, ['Cooked pasta', 'Варёная паста', 'Pâtes cuites', '熟意面'], [FoodRestrictionTag.WHEAT, FoodRestrictionTag.GLUTEN]),
  food('buckwheat-cooked', FoodCatalogCategory.GRAIN, [92, 3.4, 19.9, 0.6, 2.7], PLANT_BASED, 400, ['Cooked buckwheat', 'Варёная гречка', 'Sarrasin cuit', '熟荞麦']),
  food('barley-cooked', FoodCatalogCategory.GRAIN, [123, 2.3, 28.2, 0.4, 3.8], PLANT_BASED, 410, ['Cooked barley', 'Варёная перловка', 'Orge cuit', '熟大麦'], [FoodRestrictionTag.GLUTEN]),
  food('corn-cooked', FoodCatalogCategory.GRAIN, [96, 3.4, 21, 1.5, 2.4], PLANT_BASED, 420, ['Cooked corn', 'Варёная кукуруза', 'Maïs cuit', '熟玉米']),
  food('sweet-potato-baked', FoodCatalogCategory.GRAIN, [90, 2, 20.7, 0.2, 3.3], PLANT_BASED, 430, ['Baked sweet potato', 'Запечённый батат', 'Patate douce cuite', '烤红薯']),
  food('rice-cakes', FoodCatalogCategory.GRAIN, [387, 8.1, 81.5, 2.8, 3.5], PLANT_BASED, 440, ['Rice cakes', 'Рисовые хлебцы', 'Galettes de riz', '米饼']),
  food('whole-grain-wrap', FoodCatalogCategory.GRAIN, [300, 9, 50, 7, 7], PLANT_BASED, 450, ['Whole-grain wrap', 'Цельнозерновая тортилья', 'Wrap complet', '全麦卷饼'], [FoodRestrictionTag.WHEAT, FoodRestrictionTag.GLUTEN]),

  food('bell-pepper', FoodCatalogCategory.VEGETABLE, [31, 1, 6, 0.3, 2.1], PLANT_BASED, 460, ['Bell pepper', 'Сладкий перец', 'Poivron', '甜椒']),
  food('zucchini', FoodCatalogCategory.VEGETABLE, [17, 1.2, 3.1, 0.3, 1], PLANT_BASED, 470, ['Zucchini', 'Кабачок', 'Courgette', '西葫芦']),
  food('green-beans-cooked', FoodCatalogCategory.VEGETABLE, [35, 1.9, 7.9, 0.3, 3.2], PLANT_BASED, 480, ['Cooked green beans', 'Варёная стручковая фасоль', 'Haricots verts cuits', '熟四季豆']),
  food('mushrooms-cooked', FoodCatalogCategory.VEGETABLE, [28, 3.6, 5.3, 0.5, 2.2], PLANT_BASED, 490, ['Cooked mushrooms', 'Готовые грибы', 'Champignons cuits', '熟蘑菇']),
  food('cauliflower-cooked', FoodCatalogCategory.VEGETABLE, [23, 1.8, 4.1, 0.5, 2.3], PLANT_BASED, 500, ['Cooked cauliflower', 'Готовая цветная капуста', 'Chou-fleur cuit', '熟菜花']),
  food('asparagus-cooked', FoodCatalogCategory.VEGETABLE, [22, 2.4, 4.1, 0.2, 2], PLANT_BASED, 510, ['Cooked asparagus', 'Готовая спаржа', 'Asperges cuites', '熟芦笋']),
  food('kale-cooked', FoodCatalogCategory.VEGETABLE, [36, 2.5, 7.3, 0.5, 4.1], PLANT_BASED, 520, ['Cooked kale', 'Готовая капуста кейл', 'Chou kale cuit', '熟羽衣甘蓝']),
  food('onion', FoodCatalogCategory.VEGETABLE, [40, 1.1, 9.3, 0.1, 1.7], PLANT_BASED, 530, ['Onion', 'Лук', 'Oignon', '洋葱']),
  food('garlic', FoodCatalogCategory.VEGETABLE, [149, 6.4, 33.1, 0.5, 2.1], PLANT_BASED, 540, ['Garlic', 'Чеснок', 'Ail', '大蒜']),
  food('cabbage-cooked', FoodCatalogCategory.VEGETABLE, [23, 1.3, 5.5, 0.1, 2.3], PLANT_BASED, 550, ['Cooked cabbage', 'Готовая капуста', 'Chou cuit', '熟卷心菜']),
  food('eggplant-cooked', FoodCatalogCategory.VEGETABLE, [35, 0.8, 8.7, 0.2, 2.5], PLANT_BASED, 560, ['Cooked eggplant', 'Готовый баклажан', 'Aubergine cuite', '熟茄子']),
  food('beetroot-cooked', FoodCatalogCategory.VEGETABLE, [44, 1.7, 10, 0.2, 2], PLANT_BASED, 570, ['Cooked beetroot', 'Варёная свёкла', 'Betterave cuite', '熟甜菜']),
  food('snap-peas', FoodCatalogCategory.VEGETABLE, [42, 2.8, 7.6, 0.2, 2.6], PLANT_BASED, 580, ['Snap peas', 'Сахарный горошек', 'Pois mange-tout', '荷兰豆']),
  food('vegetable-medley', FoodCatalogCategory.VEGETABLE, [47, 2.4, 8.5, 0.4, 3], PLANT_BASED, 590, ['Mixed vegetables', 'Овощная смесь', 'Mélange de légumes', '混合蔬菜']),

  food('orange', FoodCatalogCategory.FRUIT, [47, 0.9, 11.8, 0.1, 2.4], PLANT_BASED, 600, ['Orange', 'Апельсин', 'Orange', '橙子']),
  food('pear', FoodCatalogCategory.FRUIT, [57, 0.4, 15.2, 0.1, 3.1], PLANT_BASED, 610, ['Pear', 'Груша', 'Poire', '梨']),
  food('grapes', FoodCatalogCategory.FRUIT, [69, 0.7, 18.1, 0.2, 0.9], PLANT_BASED, 620, ['Grapes', 'Виноград', 'Raisins', '葡萄']),
  food('kiwi', FoodCatalogCategory.FRUIT, [61, 1.1, 14.7, 0.5, 3], PLANT_BASED, 630, ['Kiwi', 'Киви', 'Kiwi', '猕猴桃']),
  food('peach', FoodCatalogCategory.FRUIT, [39, 0.9, 9.5, 0.3, 1.5], PLANT_BASED, 640, ['Peach', 'Персик', 'Pêche', '桃子']),
  food('mango', FoodCatalogCategory.FRUIT, [60, 0.8, 15, 0.4, 1.6], PLANT_BASED, 650, ['Mango', 'Манго', 'Mangue', '芒果']),
  food('pineapple', FoodCatalogCategory.FRUIT, [50, 0.5, 13.1, 0.1, 1.4], PLANT_BASED, 660, ['Pineapple', 'Ананас', 'Ananas', '菠萝']),
  food('strawberries', FoodCatalogCategory.FRUIT, [32, 0.7, 7.7, 0.3, 2], PLANT_BASED, 670, ['Strawberries', 'Клубника', 'Fraises', '草莓']),
  food('blueberries', FoodCatalogCategory.FRUIT, [57, 0.7, 14.5, 0.3, 2.4], PLANT_BASED, 680, ['Blueberries', 'Черника', 'Myrtilles', '蓝莓']),

  food('cottage-cheese', FoodCatalogCategory.DAIRY_OR_ALTERNATIVE, [98, 11.1, 3.4, 4.3, 0], VEGETARIAN, 690, ['Cottage cheese', 'Творог', 'Fromage cottage', '茅屋奶酪'], [FoodRestrictionTag.DAIRY]),
  food('skim-milk', FoodCatalogCategory.DAIRY_OR_ALTERNATIVE, [34, 3.4, 5, 0.1, 0], VEGETARIAN, 700, ['Skim milk', 'Обезжиренное молоко', 'Lait écrémé', '脱脂牛奶'], [FoodRestrictionTag.DAIRY]),
  food('unsweetened-soy-milk', FoodCatalogCategory.DAIRY_OR_ALTERNATIVE, [33, 3.3, 0.7, 1.8, 0.6], PLANT_BASED, 710, ['Unsweetened soy milk', 'Несладкое соевое молоко', 'Lait de soja sans sucre', '无糖豆奶'], [FoodRestrictionTag.SOY]),
  food('peanut-butter', FoodCatalogCategory.FAT, [588, 25, 20, 50, 6], PLANT_BASED, 720, ['Peanut butter', 'Арахисовая паста', 'Beurre de cacahuète', '花生酱'], [FoodRestrictionTag.PEANUT]),
  food('walnuts', FoodCatalogCategory.FAT, [654, 15.2, 13.7, 65.2, 6.7], PLANT_BASED, 730, ['Walnuts', 'Грецкие орехи', 'Noix', '核桃'], [FoodRestrictionTag.TREE_NUT]),
  food('chia-seeds', FoodCatalogCategory.FAT, [486, 16.5, 42.1, 30.7, 34.4], PLANT_BASED, 740, ['Chia seeds', 'Семена чиа', 'Graines de chia', '奇亚籽']),
  food('pumpkin-seeds', FoodCatalogCategory.FAT, [559, 30.2, 10.7, 49, 6], PLANT_BASED, 750, ['Pumpkin seeds', 'Тыквенные семечки', 'Graines de courge', '南瓜籽']),
  food('tahini', FoodCatalogCategory.FAT, [595, 17, 21, 53.8, 9.3], PLANT_BASED, 760, ['Tahini', 'Тахини', 'Tahini', '芝麻酱'], [FoodRestrictionTag.SESAME]),
  food('sunflower-seeds', FoodCatalogCategory.FAT, [584, 20.8, 20, 51.5, 8.6], PLANT_BASED, 770, ['Sunflower seeds', 'Семечки подсолнечника', 'Graines de tournesol', '葵花籽']),
  food('dark-chocolate', FoodCatalogCategory.OTHER, [598, 7.8, 45.9, 42.6, 10.9], PLANT_BASED, 780, ['Dark chocolate', 'Тёмный шоколад', 'Chocolat noir', '黑巧克力']),
  food('honey', FoodCatalogCategory.OTHER, [304, 0.3, 82.4, 0, 0.2], PLANT_BASED, 790, ['Honey', 'Мёд', 'Miel', '蜂蜜']),
  food('lemon', FoodCatalogCategory.FRUIT, [29, 1.1, 9.3, 0.3, 2.8], PLANT_BASED, 800, ['Lemon', 'Лимон', 'Citron', '柠檬'])
];
