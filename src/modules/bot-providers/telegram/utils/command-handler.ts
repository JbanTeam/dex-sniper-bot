import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '@modules/redis/redis.service';
import { chains, helpMessage, startMessage } from '@src/utils/constants';
import { IncomingMessage, SendMessageOptions } from '@src/types/types';

@Injectable()
export class CommandHandler {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async handleCommand(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    const command = message.text;

    switch (true) {
      case command.startsWith('/start'):
        return { text: startMessage };
      case command.startsWith('/help'):
        return { text: helpMessage };
      case command.startsWith('/addtoken'):
        return this.addToken(message);
      case command.startsWith('/removetoken'):
        return { text: 'Введите адрес токена. Пример: /removetoken [адрес_токена]' };
      case command.startsWith('/balance'):
        return { text: 'Введите номер кошелька.' };
      default:
        return { text: 'Неизвестная команда. Попробуйте /help.' };
    }
  }

  private async addToken(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    const [, tokenAddress] = message.text.split(' ');

    const userSession = await this.redisService.getSessionData(message.chatId.toString());

    if (!tokenAddress) {
      return {
        text: 'Введите адрес токена. Пример: /addtoken [адрес_токена]',
        options: { parse_mode: 'html' },
      };
    }

    await this.redisService.setSessionData(message.chatId.toString(), {
      ...userSession,
      tempToken: tokenAddress,
    });

    const chainsArr = Object.entries(chains(this.configService));
    const keardboard = chainsArr.map(([keyNetwork, value]) => {
      return [{ text: value.name, callback_data: `add-${keyNetwork}` }];
    });

    return {
      text: 'Выберите сеть, в которой находится ваш токен:',
      options: {
        parse_mode: 'html',
        reply_markup: { inline_keyboard: keardboard },
      },
    };
  }
}
