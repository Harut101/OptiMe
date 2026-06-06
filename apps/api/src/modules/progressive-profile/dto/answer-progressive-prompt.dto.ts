import { IsDefined } from 'class-validator';

export class AnswerProgressivePromptDto {
  @IsDefined()
  value!: string | string[] | number | boolean;
}
