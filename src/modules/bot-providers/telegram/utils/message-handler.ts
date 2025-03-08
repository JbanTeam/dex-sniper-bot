import { Injectable } from '@nestjs/common';
import { IncomingMessage, SendMessageOptions } from '@src/types/types';

@Injectable()
export class MessageHandler {
  constructor() {}

  async handleMessage(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    console.log(message.text);
    return { text: 'Вы ввели некорректную валютную пару. Введите валютную пару в формате USD-EUR.' };
  }
}
