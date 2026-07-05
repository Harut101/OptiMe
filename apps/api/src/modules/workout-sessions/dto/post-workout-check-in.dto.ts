import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

import { WORKOUT_PAIN_AREAS } from '../workout-pain-mapping';

export const POST_WORKOUT_FEELINGS = [
  'GOOD',
  'TOO_EASY',
  'TOO_HARD',
  'PAIN_DURING_WORKOUT',
  'SKIPPED'
] as const;
export type PostWorkoutFeelingValue = (typeof POST_WORKOUT_FEELINGS)[number];

export class PostWorkoutCheckInDto {
  @IsIn(POST_WORKOUT_FEELINGS)
  feeling!: PostWorkoutFeelingValue;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsIn(WORKOUT_PAIN_AREAS, { each: true })
  painAreas?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
