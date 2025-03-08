import { Address } from 'viem';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '@modules/redis/redis.service';
import { UserService } from '@modules/user/user.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { IncomingQuery, Network, SendMessageOptions } from '@src/types/types';

@Injectable()
export class QueryHandler {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {}

  async handleQuery(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    switch (true) {
      case /^add-(.+)/.test(query.data):
        return this.addTokenCb(query);
      case /^rm-(.+)/.test(query.data):
        return this.removeTokenCb(query);
      case /^balance-(.+)/.test(query.data):
        return this.getBalanceCb(query);
      default:
        return { text: 'Неизвестная команда' };
    }
  }

  private async addTokenCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    const [, network] = query.data.split('-');

    const userSession = await this.redisService.getSessionData(query.chatId.toString());

    if (!userSession) return { text: 'Пользователь не найден' };
    if (!userSession.tempToken || !userSession.userId || !userSession.chatId) {
      return { text: 'Пользователь не найден' };
    }

    try {
      const tokens = await this.userService.addToken({
        userId: userSession.userId,
        address: userSession.tempToken as Address,
        network: network as Network,
      });

      userSession.tempToken = '';
      userSession.tokens = tokens;

      await this.redisService.setSessionData(userSession.chatId.toString(), userSession);

      let reply = `Токен успешно добавлен 🔥🔥🔥\n\n<u>Ваши токены:</u>\n`;

      tokens.forEach((token, index) => {
        reply += `${index + 1}. <b>Сеть:</b> <u>${token.network}</u> / <b>Токен:</b> <u>${token.name} (${token.symbol})</u>\n<code>${token.address}</code>\n\n`;
      });

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while adding token: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async removeTokenCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    const network = query.data.split('-')[1] as Network | 'all';

    const userSession = await this.redisService.getSessionData(query.chatId.toString());

    if (!userSession || !userSession.userId || !userSession.chatId) return { text: 'Пользователь не найден' };
    const userId = userSession.userId;
    const chatId = userSession.chatId;

    try {
      let reply = '';
      if (network === 'all') {
        const deletedTokens = await this.userService.removeToken({
          userId,
          chatId,
        });

        if (!deletedTokens) throw new Error('Токены не найдены');

        reply = `Все токены успешно удалены 🔥🔥🔥`;
      } else {
        const deletedTokens = await this.userService.removeToken({
          userId,
          chatId,
          network,
        });

        if (!deletedTokens) throw new Error('Токены не найдены');

        reply = `Все токены в сети ${network} успешно удалены 🔥🔥🔥`;
      }

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while removing tokens: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async getBalanceCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    const userSession = await this.redisService.getSessionData(query.chatId.toString());

    if (!userSession || !userSession.userId || !userSession.wallets) return { text: 'Пользователь не найден' };

    const walletId = +query.data.split('-')[1];

    try {
      const wallet = userSession.wallets.find(wallet => wallet.id === walletId);

      if (!wallet) return { text: 'Кошелек не найден' };

      const balance = await this.blockchainService.getBalance({
        address: wallet.address as Address,
        network: wallet.network,
      });

      let reply = `<b>Баланс кошелька:</b>\n`;
      reply += `<b>Сеть:</b> ${wallet.network}\n`;
      reply += `<b>Адрес:</b> <code>${wallet.address}</code>\n`;
      reply += `<b>Баланс:</b> ${balance}\n`;

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while getting balance: ${error.message}`);
      return { text: `${error.message}` };
    }
  }
}
