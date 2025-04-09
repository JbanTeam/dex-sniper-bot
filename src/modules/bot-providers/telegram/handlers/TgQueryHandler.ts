import { Injectable } from '@nestjs/common';

import { BotError } from '@src/errors/BotError';
import { RedisService } from '@modules/redis/redis.service';
import { UserService } from '@modules/user/user.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { WalletService } from '@modules/wallet/wallet.service';
import { strIsPositiveNumber } from '@src/utils/utils';
import { IncomingQuery } from '@src/types/types';
import { TgCommandReturnType, TgQueryFunction } from '../types/types';
import { isBuySell, isEtherAddress, isNetwork, isValidRemoveQueryData } from '@src/types/typeGuards';
import { BaseQueryHandler } from '@modules/bot-providers/handlers/BaseQueryHandler';

@Injectable()
export class TgQueryHandler extends BaseQueryHandler<IncomingQuery, TgCommandReturnType> {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly blockchainService: BlockchainService,
    private readonly subscriptionService: SubscriptionService,
    private readonly walletService: WalletService,
  ) {
    super();
  }

  handleQuery: TgQueryFunction = async query => {
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
  };

  addTokenCb: TgQueryFunction = async query => {
    const [, network] = query.data.split('-');
    const userSession = await this.redisService.getUser(query.chatId);

    if (!userSession.tempToken) throw new BotError('Token not found', 'Токен не найден', 404);
    isEtherAddress(userSession.tempToken);

    if (!network) throw new BotError('Network not found', 'Сеть не найдена', 404);
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
  };

  removeTokenCb: TgQueryFunction = async query => {
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
  };

  getBalanceCb: TgQueryFunction = async query => {
    const walletId = +query.data.split('-')[1];
    const wallets = await this.redisService.getWallets(query.chatId);
    const wallet = wallets?.find(wallet => wallet.id === walletId);

    if (!wallet) throw new BotError('Wallet not found', 'Кошелек не найден', 404);

    const balance = await this.blockchainService.getBalance({
      chatId: query.chatId,
      address: wallet.address,
      network: wallet.network,
    });

    return { text: balance, options: { parse_mode: 'html' } };
  };

  subscribeCb: TgQueryFunction = async query => {
    const [, network] = query.data.split('-');

    const tempWallet = await this.redisService.getTempWallet(query.chatId);

    if (!tempWallet) throw new BotError('Wallet not found', 'Кошелек не найден', 404);
    isEtherAddress(tempWallet);

    if (!network) throw new BotError('Network not found', 'Сеть не найдена', 404);
    isNetwork(network);

    await this.subscriptionService.subscribeToWallet({
      chatId: query.chatId,
      address: tempWallet,
      network: network,
    });

    return { text: `Кошелек добавлен в список для отслеживания ✅`, options: { parse_mode: 'html' } };
  };

  sendTokensCb: TgQueryFunction = async query => {
    const [, network] = query.data.split('-');
    const tempSendTokens = await this.redisService.getTempSendTokens(query.chatId);

    if (!tempSendTokens) throw new BotError('Error sending tokens', 'Ошибка отправки токенов', 400);
    const [tokenAddress, amount, recipientAddress] = tempSendTokens.split(':');

    isNetwork(network);
    isEtherAddress(tokenAddress);
    isEtherAddress(recipientAddress);
    if (!strIsPositiveNumber(amount)) {
      throw new BotError('Enter correct amount of tokens', 'Введите корректное количество токенов', 400);
    }

    const userSession = await this.redisService.getUser(query.chatId);
    const wallet = userSession.wallets.find(wallet => wallet.network === network);
    if (!wallet) throw new BotError('Wallet not found', 'Кошелек не найден', 404);

    const fullWallet = await this.walletService.findByAddress(wallet.address);
    if (!fullWallet) throw new BotError('Wallet not found', 'Кошелек не найден', 404);

    await this.blockchainService.sendTokens({
      wallet: fullWallet,
      tokenAddress,
      amount,
      recipientAddress,
    });

    return { text: `Токены успешно отправлены ✅`, options: { parse_mode: 'html' } };
  };

  replicateCb: TgQueryFunction = async query => {
    const [, subscriptionId] = query.data.split('-');

    const tempReplication = await this.redisService.getTempReplication(query.chatId);
    if (!tempReplication) throw new BotError('Error setting replication', 'Не удалось установить повтор сделок', 400);

    const [action, limit] = tempReplication.split(':');
    isBuySell(action);

    const subscription = await this.subscriptionService.findById({ id: +subscriptionId });

    if (!subscription) throw new BotError('Subscription not found', 'Подписка не найдена', 404);

    await this.subscriptionService.updateSubscription({
      chatId: query.chatId,
      subscription,
      action: action,
      limit: +limit,
    });

    return { text: `Параметры повтора сделок установлены ✅`, options: { parse_mode: 'html' } };
  };
}
