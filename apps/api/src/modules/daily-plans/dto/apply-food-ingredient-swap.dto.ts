import { IsString, MaxLength } from 'class-validator';

export class ApplyFoodIngredientSwapDto {
  @IsString()
  @MaxLength(120)
  replacementCatalogFoodSlug!: string;
}
