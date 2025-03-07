import { Injectable } from '@nestjs/common';

@Injectable()
export class MessageHandler {
  constructor() {}

  async handleMessage(message: string): Promise<string> {
    console.log(message);
    return 'Вы ввели некорректную валютную пару. Введите валютную пару в формате USD-EUR.';
  }
}
