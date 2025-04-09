import { Injectable } from '@nestjs/common';
import { IncomingMessage } from '@src/types/types';
import { TgCommandFunction, TgCommandReturnType } from '../types/types';
import { BaseMessageHandler } from '@modules/bot-providers/handlers/BaseMessageHandler';

@Injectable()
export class TgMessageHandler extends BaseMessageHandler<IncomingMessage, TgCommandReturnType> {
  constructor() {
    super();
  }

  handleMessage: TgCommandFunction = async message => {
    console.log(message.text);
    return { text: 'Разговоры ни к чему, мы здесь серьезными вещами занимаемся' };
  };
}
