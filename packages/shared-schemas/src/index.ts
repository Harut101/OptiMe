import { z } from 'zod';

export const emailSchema = z.string().email().trim().toLowerCase();

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  privacyConsentAccepted: z.boolean().optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8)
});

export const profileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string(),
  heightCm: z.coerce.number().min(80).max(260),
  weightKg: z.coerce.number().min(20).max(350),
  activityLevel: z.enum(['LOW', 'LIGHT', 'MODERATE', 'HIGH', 'ATHLETE']),
  privacyConsentAccepted: z.boolean().optional()
});

export const goalSchema = z.object({
  goalType: z.enum([
    'HEALTHY_LIFESTYLE',
    'IMPROVE_FITNESS',
    'BUILD_MUSCLE',
    'IMPROVE_ENDURANCE',
    'REDUCE_WEIGHT'
  ]),
  targetWeightKg: z.coerce.number().min(20).max(350).optional(),
  targetTimelineDays: z.coerce.number().int().min(14).max(730).optional(),
  impactMode: z.enum(['NUTRITION_ONLY', 'NUTRITION_AND_TRAINING']).optional()
});

export const nutritionPreferencesSchema = z.object({
  dietType: z.enum([
    'NONE',
    'OMNIVORE',
    'VEGETARIAN',
    'VEGAN',
    'PESCATARIAN',
    'KETO',
    'LOW_CARB',
    'MEDITERRANEAN',
    'HALAL',
    'KOSHER'
  ]),
  mealsPerDay: z.coerce.number().int().min(1).max(8),
  notes: z.string().optional(),
  allergies: z.array(z.string()).max(30).optional(),
  excludedFoods: z.array(z.string()).max(60).optional(),
  preferredFoods: z.array(z.string()).max(60).optional()
});

export const trainingScheduleItemSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sportType: z.enum([
    'RUNNING',
    'CYCLING',
    'GYM',
    'STRENGTH',
    'HIIT',
    'YOGA',
    'SWIMMING',
    'WALKING',
    'TEAM_SPORT',
    'OTHER'
  ]),
  durationMinutes: z.coerce.number().int().min(1).max(300),
  intensity: z.enum(['LOW', 'MODERATE', 'HIGH']),
  description: z.string().optional()
});

export const generateDailyPlanSchema = z.object({
  forceRegenerate: z.boolean().optional()
});
