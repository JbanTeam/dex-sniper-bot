import { IsNumber } from 'class-validator';

export class RegisterDto {
  @IsNumber()
  chatId: number;
}
