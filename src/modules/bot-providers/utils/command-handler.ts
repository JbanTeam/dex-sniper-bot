import { Injectable } from '@nestjs/common';
import { startMessage } from '@src/utils/constants';

@Injectable()
export class CommandHandler {
  constructor() {}

  async handleCommand(command: string): Promise<string> {
    switch (command) {
      case '/start':
        return startMessage;
      case '/help':
        return 'Доступные команды: /start, /help, /currency.';
      default:
        return 'Неизвестная команда. Попробуйте /help.';
    }
  }
}
