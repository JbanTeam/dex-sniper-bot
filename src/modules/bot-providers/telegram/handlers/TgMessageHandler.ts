import { Injectable } from '@nestjs/common';
import { IncomingMessage } from '@src/types/types';
import { BaseMessageHandler } from '@src/common/bot-handlers/BaseMessageHandler';
import { TgCommandFunction, TgCommandReturnType } from '../types/types';

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
