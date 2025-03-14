import { Address } from 'viem';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '@modules/redis/redis.service';
import { UserService } from '@modules/user/user.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { IncomingQuery, Network, SendMessageOptions } from '@src/types/types';
import { DeleteResult } from 'typeorm';

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

    if (!userSession) throw new Error('Пользователь не найден');
    if (!userSession.tempToken) throw new Error('Токен не найден');

    try {
      const { tokens, testTokens } = await this.userService.addToken({
        userId: userSession.userId,
        address: userSession.tempToken as Address,
        network: network as Network,
      });

      userSession.tempToken = '';
      userSession.tokens = tokens;
      if (testTokens?.length) userSession.testTokens = testTokens;

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

    if (!userSession) throw new Error('Пользователь не найден');
    const userId = userSession.userId;
    const chatId = userSession.chatId;

    try {
      let reply = '';
      let deletedTokens: DeleteResult;
      if (network === 'all') {
        deletedTokens = await this.userService.removeToken({
          userId,
          chatId,
        });

        reply = `Все токены успешно удалены 🔥🔥🔥`;
      } else {
        deletedTokens = await this.userService.removeToken({
          userId,
          chatId,
          network,
        });

        reply = `Все токены в сети ${network} успешно удалены 🔥🔥🔥`;
      }
      if (!deletedTokens.affected) throw new Error('Токены не найдены');

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while removing tokens: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async getBalanceCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    const userSession = await this.redisService.getSessionData(query.chatId.toString());

    try {
      if (!userSession) throw new Error('Пользователь не найден');

      const walletId = +query.data.split('-')[1];
      const wallet = userSession.wallets.find(wallet => wallet.id === walletId);

      if (!wallet) throw new Error('Кошелек не найден');

      const balance = await this.blockchainService.getBalance({
        chatId: query.chatId,
        address: wallet.address as Address,
        network: wallet.network,
      });

      return { text: balance, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while getting balance: ${error.message}`);
      return { text: `${error.message}` };
    }
  }
}
