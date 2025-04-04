import { Injectable } from '@nestjs/common';
import { IncomingMessage, SendMessageOptions } from '@src/types/types';

@Injectable()
export class MessageHandler {
  constructor() {}

  async handleMessage(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    console.log(message.text);
    return { text: 'Разговоры ни к чему, мы здесь серьезными вещами занимаемся' };
  }
}
