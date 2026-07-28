import { z } from 'zod';

const finiteNumber = z.number().finite();
const isoDateTime = z.string().datetime({ offset: true });

const cycleRecordSchema = z.object({
  id: z.number().int(),
  start: isoDateTime,
  end: isoDateTime.nullable(),
  score: z.object({
    strain: finiteNumber,
    kilojoule: finiteNumber,
    average_heart_rate: finiteNumber,
    max_heart_rate: finiteNumber
  }).passthrough().nullable().optional()
}).passthrough();

const recoveryRecordSchema = z.object({
  cycle_id: z.number().int(),
  created_at: isoDateTime,
  score_state: z.enum(['SCORED', 'PENDING_SCORE', 'UNSCORABLE']),
  score: z.object({
    user_calibrating: z.boolean(),
    recovery_score: finiteNumber,
    resting_heart_rate: finiteNumber,
    hrv_rmssd_milli: finiteNumber,
    spo2_percentage: finiteNumber.nullable().optional(),
    skin_temp_celsius: finiteNumber.nullable().optional()
  }).passthrough().nullable().optional()
}).passthrough().superRefine((record, context) => {
  if (record.score_state === 'SCORED' && !record.score) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['score'],
      message: 'A scored WHOOP recovery record must include score data.'
    });
  }
});

const sleepRecordSchema = z.object({
  id: z.string().min(1),
  start: isoDateTime,
  end: isoDateTime,
  nap: z.boolean(),
  score: z.object({
    stage_summary: z.object({
      total_light_sleep_time_milli: finiteNumber,
      total_slow_wave_sleep_time_milli: finiteNumber,
      total_rem_sleep_time_milli: finiteNumber,
      total_awake_time_milli: finiteNumber.optional()
    }).passthrough(),
    sleep_performance_percentage: finiteNumber.nullable().optional(),
    respiratory_rate: finiteNumber.nullable().optional()
  }).passthrough().nullable().optional()
}).passthrough();

const workoutRecordSchema = z.object({
  id: z.string().min(1),
  start: isoDateTime,
  end: isoDateTime,
  score: z.object({
    strain: finiteNumber,
    kilojoule: finiteNumber
  }).passthrough().nullable().optional()
}).passthrough();

function collectionSchema<T extends z.ZodTypeAny>(record: T) {
  return z.object({
    records: z.array(record).max(100),
    next_token: z.string().nullable().optional()
  }).passthrough();
}

export const whoopCycleCollectionSchema = collectionSchema(cycleRecordSchema);
export const whoopRecoveryCollectionSchema = collectionSchema(recoveryRecordSchema);
export const whoopSleepCollectionSchema = collectionSchema(sleepRecordSchema);
export const whoopWorkoutCollectionSchema = collectionSchema(workoutRecordSchema);

export type WhoopCycleCollection = z.infer<typeof whoopCycleCollectionSchema>;
export type WhoopRecoveryCollection = z.infer<typeof whoopRecoveryCollectionSchema>;
export type WhoopSleepCollection = z.infer<typeof whoopSleepCollectionSchema>;
export type WhoopWorkoutCollection = z.infer<typeof whoopWorkoutCollectionSchema>;
