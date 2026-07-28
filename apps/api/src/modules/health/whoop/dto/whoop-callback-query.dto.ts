import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class WhoopCallbackQueryDto {
  @IsString()
  @Length(8, 128)
  state!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  error?: string;

  @IsOptional()
  @IsString()
  error_description?: string;

  @IsOptional()
  @IsString()
  error_uri?: string;
}
