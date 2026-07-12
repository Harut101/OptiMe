import { DietType, FoodCatalogCategory, FoodRestrictionTag } from '@prisma/client';

import type { SeedFoodCatalogItem } from './types';

function translations(
  en: [string, ...string[]],
  ru: [string, ...string[]],
  fr: [string, ...string[]],
  zh: [string, ...string[]]
) {
  return [
    { locale: 'en-US' as const, name: en[0], aliases: en.slice(1) },
    { locale: 'ru-RU' as const, name: ru[0], aliases: ru.slice(1) },
    { locale: 'fr-FR' as const, name: fr[0], aliases: fr.slice(1) },
    { locale: 'zh-CN' as const, name: zh[0], aliases: zh.slice(1) }
  ];
}

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

export const foodCatalog: SeedFoodCatalogItem[] = [
  {
    slug: 'rolled-oats', category: FoodCatalogCategory.GRAIN, caloriesPer100g: 379,
    proteinPer100g: 13.2, carbsPer100g: 67.7, fatPer100g: 6.5, fiberPer100g: 10.1,
    dietTypes: PLANT_BASED, sortOrder: 10,
    translations: translations(['Rolled oats', 'oats'], ['Овсяные хлопья', 'овсянка'], ['Flocons d’avoine', 'avoine'], ['燕麦片', '燕麦'])
  },
  {
    slug: 'egg', category: FoodCatalogCategory.PROTEIN, caloriesPer100g: 143,
    proteinPer100g: 12.6, carbsPer100g: 0.7, fatPer100g: 9.5, fiberPer100g: 0,
    dietTypes: VEGETARIAN, restrictionTags: [FoodRestrictionTag.EGG], sortOrder: 20,
    translations: translations(['Egg', 'eggs'], ['Яйцо', 'яйца'], ['Œuf', 'œufs'], ['鸡蛋'])
  },
  {
    slug: 'greek-yogurt-plain', category: FoodCatalogCategory.DAIRY_OR_ALTERNATIVE, caloriesPer100g: 73,
    proteinPer100g: 9, carbsPer100g: 3.9, fatPer100g: 2, fiberPer100g: 0,
    dietTypes: VEGETARIAN, restrictionTags: [FoodRestrictionTag.DAIRY], sortOrder: 30,
    translations: translations(['Plain Greek yogurt', 'Greek yogurt'], ['Натуральный греческий йогурт', 'греческий йогурт'], ['Yaourt grec nature', 'yaourt grec'], ['原味希腊酸奶'])
  },
  {
    slug: 'chicken-breast-cooked', category: FoodCatalogCategory.PROTEIN, caloriesPer100g: 165,
    proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, fiberPer100g: 0,
    dietTypes: [DietType.OMNIVORE], sortOrder: 40,
    translations: translations(['Cooked chicken breast', 'chicken breast', 'chicken'], ['Готовая куриная грудка', 'куриная грудка', 'курица'], ['Blanc de poulet cuit', 'blanc de poulet', 'poulet'], ['熟鸡胸肉', '鸡胸肉', '鸡肉'])
  },
  {
    slug: 'salmon-cooked', category: FoodCatalogCategory.PROTEIN, caloriesPer100g: 206,
    proteinPer100g: 22, carbsPer100g: 0, fatPer100g: 12, fiberPer100g: 0,
    dietTypes: [DietType.OMNIVORE, DietType.PESCATARIAN, DietType.MEDITERRANEAN], restrictionTags: [FoodRestrictionTag.FISH], sortOrder: 50,
    translations: translations(['Cooked salmon', 'salmon'], ['Готовый лосось', 'лосось'], ['Saumon cuit', 'saumon'], ['熟三文鱼', '三文鱼'])
  },
  {
    slug: 'firm-tofu', category: FoodCatalogCategory.PROTEIN, caloriesPer100g: 144,
    proteinPer100g: 17, carbsPer100g: 2.8, fatPer100g: 8.7, fiberPer100g: 2.3,
    dietTypes: PLANT_BASED, restrictionTags: [FoodRestrictionTag.SOY], sortOrder: 60,
    translations: translations(['Firm tofu', 'tofu'], ['Твёрдый тофу', 'тофу'], ['Tofu ferme', 'tofu'], ['老豆腐', '豆腐'])
  },
  {
    slug: 'lentils-cooked', category: FoodCatalogCategory.LEGUME, caloriesPer100g: 116,
    proteinPer100g: 9, carbsPer100g: 20.1, fatPer100g: 0.4, fiberPer100g: 7.9,
    dietTypes: PLANT_BASED, sortOrder: 70,
    translations: translations(['Cooked lentils', 'lentils'], ['Варёная чечевица', 'чечевица'], ['Lentilles cuites', 'lentilles'], ['熟扁豆', '扁豆'])
  },
  {
    slug: 'chickpeas-cooked', category: FoodCatalogCategory.LEGUME, caloriesPer100g: 164,
    proteinPer100g: 8.9, carbsPer100g: 27.4, fatPer100g: 2.6, fiberPer100g: 7.6,
    dietTypes: PLANT_BASED, sortOrder: 80,
    translations: translations(['Cooked chickpeas', 'chickpeas'], ['Варёный нут', 'нут'], ['Pois chiches cuits', 'pois chiches'], ['熟鹰嘴豆', '鹰嘴豆'])
  },
  {
    slug: 'brown-rice-cooked', category: FoodCatalogCategory.GRAIN, caloriesPer100g: 123,
    proteinPer100g: 2.7, carbsPer100g: 25.6, fatPer100g: 1, fiberPer100g: 1.6,
    dietTypes: PLANT_BASED, sortOrder: 90,
    translations: translations(['Cooked brown rice', 'brown rice'], ['Варёный бурый рис', 'бурый рис'], ['Riz complet cuit', 'riz complet'], ['熟糙米', '糙米'])
  },
  {
    slug: 'quinoa-cooked', category: FoodCatalogCategory.GRAIN, caloriesPer100g: 120,
    proteinPer100g: 4.4, carbsPer100g: 21.3, fatPer100g: 1.9, fiberPer100g: 2.8,
    dietTypes: PLANT_BASED, sortOrder: 100,
    translations: translations(['Cooked quinoa', 'quinoa'], ['Варёная киноа', 'киноа'], ['Quinoa cuite', 'quinoa'], ['熟藜麦', '藜麦'])
  },
  {
    slug: 'whole-grain-bread', category: FoodCatalogCategory.GRAIN, caloriesPer100g: 247,
    proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 4.2, fiberPer100g: 6,
    dietTypes: PLANT_BASED, restrictionTags: [FoodRestrictionTag.WHEAT, FoodRestrictionTag.GLUTEN], sortOrder: 110,
    translations: translations(['Whole-grain bread', 'whole wheat bread'], ['Цельнозерновой хлеб', 'хлеб из цельного зерна'], ['Pain complet', 'pain complet'], ['全麦面包'])
  },
  {
    slug: 'baked-potato', category: FoodCatalogCategory.GRAIN, caloriesPer100g: 93,
    proteinPer100g: 2.5, carbsPer100g: 21.2, fatPer100g: 0.1, fiberPer100g: 2.2,
    dietTypes: PLANT_BASED, sortOrder: 120,
    translations: translations(['Baked potato', 'potato'], ['Запечённый картофель', 'картофель'], ['Pomme de terre au four', 'pomme de terre'], ['烤土豆', '土豆'])
  },
  {
    slug: 'broccoli-cooked', category: FoodCatalogCategory.VEGETABLE, caloriesPer100g: 35,
    proteinPer100g: 2.4, carbsPer100g: 7.2, fatPer100g: 0.4, fiberPer100g: 3.3,
    dietTypes: PLANT_BASED, sortOrder: 130,
    translations: translations(['Cooked broccoli', 'broccoli'], ['Готовая брокколи', 'брокколи'], ['Brocoli cuit', 'brocoli'], ['熟西兰花', '西兰花'])
  },
  {
    slug: 'spinach', category: FoodCatalogCategory.VEGETABLE, caloriesPer100g: 23,
    proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4, fiberPer100g: 2.2,
    dietTypes: PLANT_BASED, sortOrder: 140,
    translations: translations(['Spinach', 'baby spinach'], ['Шпинат'], ['Épinards', 'épinard'], ['菠菜'])
  },
  {
    slug: 'mixed-salad-greens', category: FoodCatalogCategory.VEGETABLE, caloriesPer100g: 17,
    proteinPer100g: 1.4, carbsPer100g: 3.1, fatPer100g: 0.2, fiberPer100g: 1.8,
    dietTypes: PLANT_BASED, sortOrder: 150,
    translations: translations(['Mixed salad greens', 'salad greens'], ['Салатная зелень', 'микс салата'], ['Mélange de salade', 'salade verte'], ['混合沙拉菜', '沙拉菜'])
  },
  {
    slug: 'tomato', category: FoodCatalogCategory.VEGETABLE, caloriesPer100g: 18,
    proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2, fiberPer100g: 1.2,
    dietTypes: PLANT_BASED, sortOrder: 160,
    translations: translations(['Tomato', 'tomatoes'], ['Помидор', 'помидоры'], ['Tomate', 'tomates'], ['番茄', '西红柿'])
  },
  {
    slug: 'cucumber', category: FoodCatalogCategory.VEGETABLE, caloriesPer100g: 15,
    proteinPer100g: 0.7, carbsPer100g: 3.6, fatPer100g: 0.1, fiberPer100g: 0.5,
    dietTypes: PLANT_BASED, sortOrder: 170,
    translations: translations(['Cucumber', 'cucumbers'], ['Огурец', 'огурцы'], ['Concombre', 'concombres'], ['黄瓜'])
  },
  {
    slug: 'carrot', category: FoodCatalogCategory.VEGETABLE, caloriesPer100g: 41,
    proteinPer100g: 0.9, carbsPer100g: 9.6, fatPer100g: 0.2, fiberPer100g: 2.8,
    dietTypes: PLANT_BASED, sortOrder: 180,
    translations: translations(['Carrot', 'carrots'], ['Морковь'], ['Carotte', 'carottes'], ['胡萝卜'])
  },
  {
    slug: 'mixed-berries', category: FoodCatalogCategory.FRUIT, caloriesPer100g: 57,
    proteinPer100g: 0.7, carbsPer100g: 14.5, fatPer100g: 0.3, fiberPer100g: 2.4,
    dietTypes: PLANT_BASED, sortOrder: 190,
    translations: translations(['Mixed berries', 'berries'], ['Смесь ягод', 'ягоды'], ['Mélange de baies', 'baies'], ['混合莓果', '浆果'])
  },
  {
    slug: 'banana', category: FoodCatalogCategory.FRUIT, caloriesPer100g: 89,
    proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3, fiberPer100g: 2.6,
    dietTypes: PLANT_BASED, sortOrder: 200,
    translations: translations(['Banana', 'bananas'], ['Банан', 'бананы'], ['Banane', 'bananes'], ['香蕉'])
  },
  {
    slug: 'apple', category: FoodCatalogCategory.FRUIT, caloriesPer100g: 52,
    proteinPer100g: 0.3, carbsPer100g: 13.8, fatPer100g: 0.2, fiberPer100g: 2.4,
    dietTypes: PLANT_BASED, sortOrder: 210,
    translations: translations(['Apple', 'apples'], ['Яблоко', 'яблоки'], ['Pomme', 'pommes'], ['苹果'])
  },
  {
    slug: 'avocado', category: FoodCatalogCategory.FAT, caloriesPer100g: 160,
    proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 14.7, fiberPer100g: 6.7,
    dietTypes: PLANT_BASED, sortOrder: 220,
    translations: translations(['Avocado', 'avocados'], ['Авокадо'], ['Avocat', 'avocats'], ['牛油果', '鳄梨'])
  },
  {
    slug: 'olive-oil', category: FoodCatalogCategory.FAT, caloriesPer100g: 884,
    proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, fiberPer100g: 0,
    dietTypes: PLANT_BASED, sortOrder: 230,
    translations: translations(['Olive oil'], ['Оливковое масло'], ['Huile d’olive'], ['橄榄油'])
  },
  {
    slug: 'almonds', category: FoodCatalogCategory.FAT, caloriesPer100g: 579,
    proteinPer100g: 21.2, carbsPer100g: 21.6, fatPer100g: 49.9, fiberPer100g: 12.5,
    dietTypes: PLANT_BASED, restrictionTags: [FoodRestrictionTag.TREE_NUT], sortOrder: 240,
    translations: translations(['Almonds', 'almond'], ['Миндаль'], ['Amandes', 'amande'], ['杏仁'])
  }
];
