import { IsString, MaxLength } from 'class-validator';

export class ExcludeFoodIngredientDto {
  @IsString()
  @MaxLength(120)
  ingredientName!: string;
}
