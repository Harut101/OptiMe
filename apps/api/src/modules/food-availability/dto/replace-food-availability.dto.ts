import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReplaceFoodAvailabilityDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  catalogFoodSlugs!: string[];
}
