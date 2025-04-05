import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '@modules/redis/redis.service';
import { UserService } from '@modules/user/user.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { WalletService } from '@modules/wallet/wallet.service';
import { strIsPositiveNumber } from '@src/utils/utils';
import { IncomingQuery, SendMessageOptions } from '@src/types/types';
import { isBuySell, isEtherAddress, isNetwork, isValidRemoveQueryData } from '@src/types/typeGuards';

@Injectable()
export class QueryHandler {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly blockchainService: BlockchainService,
    private readonly subscriptionService: SubscriptionService,
    private readonly walletService: WalletService,
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
      case /^subnet-(.+)/.test(query.data):
        return this.subscribeCb(query);
      case /^sub-(.+)/.test(query.data):
        return this.replicateCb(query);
      case /^send-(.+)/.test(query.data):
        return this.sendTokensCb(query);
      default:
        return { text: 'Неизвестная команда' };
    }
  }

  private async addTokenCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const [, network] = query.data.split('-');
      const userSession = await this.redisService.getUser(query.chatId);

      if (!userSession.tempToken) throw new Error('Токен не найден');
      isEtherAddress(userSession.tempToken);

      if (!network) throw new Error('Сеть не найдена');
      isNetwork(network);

      const { tokens } = await this.userService.addToken({
        userSession,
        address: userSession.tempToken,
        network: network,
      });

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
    try {
      let reply = '';
      const network = query.data.split('-')[1];
      const chatId = query.chatId;

      isValidRemoveQueryData(network);

      if (network === 'all') {
        await this.userService.removeToken({ chatId });

        reply = `Все токены успешно удалены 🔥🔥🔥`;
      } else {
        await this.userService.removeToken({ chatId, network });

        reply = `Все токены в сети ${network} успешно удалены 🔥🔥🔥`;
      }

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while removing tokens: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async getBalanceCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const walletId = +query.data.split('-')[1];
      const wallets = await this.redisService.getWallets(query.chatId);
      const wallet = wallets?.find(wallet => wallet.id === walletId);

      if (!wallet) throw new Error('Кошелек не найден');

      const balance = await this.blockchainService.getBalance({
        chatId: query.chatId,
        address: wallet.address,
        network: wallet.network,
      });

      return { text: balance, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while getting balance: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async subscribeCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const [, network] = query.data.split('-');

      const tempWallet = await this.redisService.getTempWallet(query.chatId);

      if (!tempWallet) throw new Error('Кошелек не найден');
      isEtherAddress(tempWallet);

      if (!network) throw new Error('Сеть не найдена');
      isNetwork(network);

      await this.subscriptionService.subscribeToWallet({
        chatId: query.chatId,
        address: tempWallet,
        network: network,
      });

      return { text: `Кошелек добавлен в список для отслеживания ✅`, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while adding wallet to subscription list: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async sendTokensCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const [, network] = query.data.split('-');
      if (!network) throw new Error('Сеть не найдена');

      const tempSendTokens = await this.redisService.getTempSendTokens(query.chatId);

      if (!tempSendTokens) throw new Error('Ошибка отправки токенов');
      const [tokenAddress, amount, recipientAddress] = tempSendTokens.split(':');

      isNetwork(network);
      isEtherAddress(tokenAddress);
      isEtherAddress(recipientAddress);
      if (!strIsPositiveNumber(amount)) throw new Error('Введите корректное количество токенов');

      const userSession = await this.redisService.getUser(query.chatId);
      const wallet = userSession.wallets.find(wallet => wallet.network === network);
      if (!wallet) throw new Error('Кошелек не найден');

      const fullWallet = await this.walletService.findByAddress(wallet.address);
      if (!fullWallet) throw new Error('Кошелек не найден');

      await this.blockchainService.sendTokens({
        wallet: fullWallet,
        tokenAddress,
        amount,
        recipientAddress,
      });

      return { text: `Токены успешно отправлены ✅`, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while sending tokens: ${error.details}`);
      return { text: `${error.message}` };
    }
  }

  private async replicateCb(query: IncomingQuery): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const [, subscriptionId] = query.data.split('-');

      const tempReplication = await this.redisService.getTempReplication(query.chatId);
      if (!tempReplication) throw new Error('Не удалось установить повтор сделок');

      const [action, limit] = tempReplication.split(':');
      isBuySell(action);

      const subscription = await this.subscriptionService.findById({ id: +subscriptionId });

      if (!subscription) throw new Error('Подписка не найдена');

      await this.subscriptionService.updateSubscription({
        chatId: query.chatId,
        subscription,
        action: action,
        limit: +limit,
      });

      return { text: `Параметры повтора сделок установлены ✅`, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while setting replication params: ${error.message}`);
      return { text: `${error.message}` };
    }
  }
}
