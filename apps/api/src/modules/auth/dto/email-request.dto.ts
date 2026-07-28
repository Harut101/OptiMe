import { IsEmail } from 'class-validator';

export class EmailRequestDto {
  @IsEmail()
  email!: string;
}
