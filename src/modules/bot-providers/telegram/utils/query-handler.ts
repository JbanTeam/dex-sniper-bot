import { Address } from 'viem';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '@modules/redis/redis.service';
import { UserService } from '@modules/user/user.service';
import { IncomingQuery, Network, SendMessageOptions } from '@src/types/types';

@Injectable()
export class QueryHandler {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async handleQuery(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    switch (true) {
      case /^add-(.+)/.test(query.data):
        return this.addTokenCb(query);
      default:
        return { text: 'Неизвестная команда' };
    }
  }

  private async addTokenCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    const [, network] = query.data.split('-');

    const userSession = await this.redisService.getSessionData(query.chatId.toString());

    if (!userSession) {
      return {
        text: 'Пользователь не найден',
      };
    }
    if (!userSession.tempToken || !userSession.userId || !userSession.chatId) {
      return {
        text: 'Пользователь не найден',
      };
    }

    try {
      const tokens = await this.userService.addToken({
        userId: userSession.userId,
        address: userSession.tempToken as Address,
        network: network as Network,
      });

      userSession.tempToken = '';

      await this.redisService.setSessionData(userSession.chatId.toString(), userSession);

      let reply = `Токен успешно добавлен 🔥🔥🔥\n\n<u>Ваши токены:</u>\n`;

      tokens.forEach((token, index) => {
        reply += `${index + 1}. <b>Сеть:</b> <u>${token.network}</u> / <b>Токен:</b> <u>${token.name} (${token.symbol})</u>\n<code>${token.address}</code>\n\n`;
      });

      return {
        text: reply,
        options: {
          parse_mode: 'html',
        },
      };
    } catch (error) {
      return { text: `${error.message}` };
    }
  }
}
