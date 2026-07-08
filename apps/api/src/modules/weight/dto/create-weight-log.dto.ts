import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export enum WeightUnitDto {
  KG = 'KG',
  LB = 'LB'
}

export class CreateWeightLogDto {
  @IsNumber()
  weight!: number;

  @IsEnum(WeightUnitDto)
  unit!: WeightUnitDto;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  localDate?: string;

  @IsOptional()
  @IsISO8601()
  measuredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}
