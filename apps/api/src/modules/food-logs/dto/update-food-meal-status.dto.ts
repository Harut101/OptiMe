import { FoodMealProgressStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateFoodMealStatusDto {
  @IsEnum(FoodMealProgressStatus)
  status!: FoodMealProgressStatus;
}
