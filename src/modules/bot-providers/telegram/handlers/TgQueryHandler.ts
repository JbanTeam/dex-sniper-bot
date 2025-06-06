import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { BotError } from '@libs/core/errors';
import { IncomingQuery } from '@src/types/types';
import { strIsPositiveNumber } from '@libs/core/utils';
import { RedisService } from '@modules/redis/redis.service';
import { WalletService } from '@modules/wallet/wallet.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { UserTokenService } from '@modules/user-token/user-token.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { BaseQueryHandler } from '@src/common/bot-handlers/BaseQueryHandler';
import { ReplicationService } from '@modules/replication/replication.service';
import { TgCommandReturnType, TgQueryFunction, TgSendMessageOptions } from '../types/types';
import { isEtherAddress, isNetwork, isValidRemoveQueryData } from '@src/types/typeGuards';

@Injectable()
export class TgQueryHandler extends BaseQueryHandler<IncomingQuery, TgCommandReturnType> {
  constructor(
    private readonly tokenService: UserTokenService,
    private readonly redisService: RedisService,
    private readonly blockchainService: BlockchainService,
    private readonly subscriptionService: SubscriptionService,
    private readonly replicationService: ReplicationService,
    private readonly walletService: WalletService,
    private readonly constants: ConstantsProvider,
  ) {
    const logger = new Logger(TgQueryHandler.name);
    super(logger);
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
      case /^repl-(.+)-(.+)/.test(query.data):
        return this.replicateSetSubscription(query);
      case /^repltoken-(.+)/.test(query.data):
        return this.replicateCb(query);
      case /^send-(.+)/.test(query.data):
        return this.sendTokensCb(query);
      default:
        return { text: 'Неизвестная команда' };
    }
  };

  addTokenCb: TgQueryFunction = async query => {
    try {
      const [, network] = query.data.split('-');
      const userSession = await this.redisService.getUser(query.chatId);

      if (!userSession.tempToken) throw new BotError('Token not found', 'Токен не найден', HttpStatus.NOT_FOUND);

      isEtherAddress(userSession.tempToken);

      if (!network) throw new BotError('Network not found', 'Сеть не найдена', HttpStatus.NOT_FOUND);

      isNetwork(network);

      const reply = await this.tokenService.addToken({
        userSession,
        address: userSession.tempToken,
        network: network,
      });

      return { text: `Токен успешно добавлен 🔥🔥🔥\n\n${reply}`, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while adding token', 'Ошибка при добавлении токена');
    }
  };

  removeTokenCb: TgQueryFunction = async query => {
    try {
      let reply = '';
      const network = query.data.split('-')[1];
      const chatId = query.chatId;

      isValidRemoveQueryData(network);

      if (network === 'all') {
        await this.tokenService.removeToken({ chatId });

        reply = `Все токены успешно удалены 🔥🔥🔥`;
      } else {
        await this.tokenService.removeToken({ chatId, network });

        reply = `Все токены в сети ${network} успешно удалены 🔥🔥🔥`;
      }

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while removing tokens', 'Ошибка при удалении токенов');
    }
  };

  getBalanceCb: TgQueryFunction = async query => {
    try {
      const walletId = +query.data.split('-')[1];
      const wallets = await this.redisService.getWallets(query.chatId);
      const wallet = wallets?.find(wallet => wallet.id === walletId);

      if (!wallet) throw new BotError('Wallet not found', 'Кошелек не найден', HttpStatus.NOT_FOUND);

      const balance = await this.blockchainService.getBalance({
        chatId: query.chatId,
        address: wallet.address,
        network: wallet.network,
      });

      return { text: balance, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while getting balance', 'Ошибка при получении баланса');
    }
  };

  subscribeCb: TgQueryFunction = async query => {
    try {
      const [, network] = query.data.split('-');
      const tempWallet = await this.redisService.getTempWallet(query.chatId);

      if (!tempWallet) throw new BotError('Wallet not found', 'Кошелек не найден', HttpStatus.NOT_FOUND);

      isEtherAddress(tempWallet);

      if (!network) throw new BotError('Network not found', 'Сеть не найдена', HttpStatus.NOT_FOUND);

      isNetwork(network);

      await this.subscriptionService.subscribeToWallet({
        chatId: query.chatId,
        address: tempWallet,
        network: network,
      });

      return { text: `Кошелек добавлен в список для отслеживания ✅`, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while subscribing to wallet', 'Ошибка при подписке на кошелек');
    }
  };

  sendTokensCb: TgQueryFunction = async query => {
    try {
      const [, network] = query.data.split('-');
      const tempSendTokens = await this.redisService.getTempSendTokens(query.chatId);

      if (!tempSendTokens) {
        throw new BotError('Error sending tokens', 'Ошибка отправки токенов', HttpStatus.BAD_REQUEST);
      }

      const [tokenAddress, amount, recipientAddress] = tempSendTokens.split(':');

      isNetwork(network);
      isEtherAddress(recipientAddress);

      if (!strIsPositiveNumber(amount)) {
        throw new BotError(
          'Enter correct amount of tokens',
          'Введите корректное количество токенов',
          HttpStatus.BAD_REQUEST,
        );
      }

      const userSession = await this.redisService.getUser(query.chatId);
      const wallet = userSession.wallets.find(wallet => wallet.network === network);

      if (!wallet) throw new BotError('Wallet not found', 'Кошелек не найден', HttpStatus.NOT_FOUND);

      const fullWallet = await this.walletService.findByAddress(wallet.address);

      if (!fullWallet) throw new BotError('Wallet not found', 'Кошелек не найден', HttpStatus.NOT_FOUND);

      let reply: string;

      if (tokenAddress === 'native') {
        const currency = this.constants.chains[network].tokenSymbol;
        await this.blockchainService.sendNative({
          userSession,
          wallet: fullWallet,
          amount,
          recipientAddress,
        });

        reply = `${currency} успешно отправлены ✅`;
      } else {
        isEtherAddress(tokenAddress);
        const token = userSession.tokens.find(token => token.address === tokenAddress);

        if (!token) {
          throw new BotError('Token not found', 'Токен не найден в списке добавленных', HttpStatus.NOT_FOUND);
        }

        await this.blockchainService.sendTokens({
          userSession,
          wallet: fullWallet,
          token,
          amount,
          recipientAddress,
        });

        reply = `${token.symbol} успешно отправлены ✅`;
      }

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while sending tokens', 'Ошибка при отправке токенов');
    }
  };

  replicateCb: TgQueryFunction = async query => {
    try {
      const [, tokenId] = query.data.split('-');
      const tempReplication = await this.redisService.getTempReplication(query.chatId);

      if (!tempReplication) {
        throw new BotError('Error setting replication', 'Не удалось установить повтор сделок', HttpStatus.BAD_REQUEST);
      }

      tempReplication.tokenId = +tokenId;
      const reply = await this.replicationService.createOrUpdateReplication(tempReplication);

      return { text: `Параметры повтора сделок установлены ✅\n\n${reply}`, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while setting replication', 'Ошибка при установке повтора сделок');
    }
  };

  handleError(error: unknown, errMsg: string, userMsg: string): { text: string; options?: TgSendMessageOptions } {
    this.logger.error(`${errMsg}`, error);

    if (error instanceof BotError) {
      return { text: error.userMessage, options: { parse_mode: 'html' } };
    }

    return { text: userMsg, options: { parse_mode: 'html' } };
  }

  private replicateSetSubscription: TgQueryFunction = async query => {
    try {
      const [, subscriptionId, network] = query.data.split('-');

      isNetwork(network);

      const tempReplication = await this.redisService.getTempReplication(query.chatId);

      if (!tempReplication) {
        throw new BotError('Error setting replication', 'Не удалось установить повтор сделок', HttpStatus.BAD_REQUEST);
      }

      tempReplication.subscriptionId = +subscriptionId;
      tempReplication.network = network;

      await this.redisService.setUserField(query.chatId, 'tempReplication', JSON.stringify(tempReplication));

      const tokens = await this.redisService.getTokens(query.chatId, 'tokens');

      const keyboard = tokens?.map(token => {
        return [{ text: `${token.name} (${token.symbol})`, callback_data: `repltoken-${token.id}` }];
      });

      return {
        text: 'Выберите токен для установки параметров:',
        options: { reply_markup: { inline_keyboard: keyboard } },
      };
    } catch (error) {
      return this.handleError(error, 'Error while setting replication', 'Ошибка при установке повтора сделок');
    }
  };
}
