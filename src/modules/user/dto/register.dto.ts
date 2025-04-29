import { IsNumber } from 'class-validator';
// TODO: need:?
export class RegisterDto {
  @IsNumber()
  chatId: number;
}
