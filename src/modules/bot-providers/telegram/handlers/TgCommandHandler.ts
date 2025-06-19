import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { BotError } from '@libs/core/errors';
import { IncomingMessage, TokenAddressType } from '@src/types/types';
import { strIsPositiveNumber } from '@libs/core/utils';
import { WalletService } from '@modules/wallet/wallet.service';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { UserTokenService } from '@modules/user-token/user-token.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { ReplicationService } from '@modules/replication/replication.service';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { BaseCommandHandler } from '@src/common/bot-handlers/BaseCommandHandler';
import { isBuySell, isEtherAddress } from '@src/types/typeGuards';
import { commandsRegexp, HELP_MESSAGE, START_MESSAGE } from '@src/constants';
import { TgCommandFunction, TgCommandReturnType, TgSendMessageOptions } from '../types/types';

@Injectable()
export class TgCommandHandler extends BaseCommandHandler<IncomingMessage, TgCommandReturnType> {
  constructor(
    private readonly tokenService: UserTokenService,
    private readonly redisService: RedisService,
    private readonly blockchainService: BlockchainService,
    private readonly subscriptionService: SubscriptionService,
    private readonly replicationService: ReplicationService,
    private readonly walletService: WalletService,
    private readonly constants: ConstantsProvider,
  ) {
    const logger = new Logger(TgCommandHandler.name);
    super(logger);
  }

  handleCommand: TgCommandFunction = async message => {
    const commandPatterns: [RegExp, TgCommandFunction][] = [
      [commandsRegexp.start, async () => ({ text: START_MESSAGE })],
      [commandsRegexp.help, async () => ({ text: HELP_MESSAGE })],
      [commandsRegexp.wallets, this.getWallets],
      [commandsRegexp.addToken, this.addToken],
      [commandsRegexp.removeToken, this.removeToken],
      [commandsRegexp.tokens, this.getTokens],
      [commandsRegexp.follow, this.subscribe],
      [commandsRegexp.unfollow, this.unsubscribe],
      [commandsRegexp.subscriptions, this.getSubscriptions],
      [commandsRegexp.replicate, this.replicate],
      [commandsRegexp.replications, this.getReplications],
      [commandsRegexp.balance, this.getBalance],
      [commandsRegexp.send, this.sendTokens],
      [commandsRegexp.fakeTo, this.fakeSwapTo],
      [commandsRegexp.fakeFrom, this.fakeSwapFrom],
    ];

    for (const [pattern, handler] of commandPatterns) {
      if (pattern.test(message.text)) {
        return handler(message);
      }
    }

    return { text: 'Неизвестная команда. Попробуйте /help.' };
  };

  addToken: TgCommandFunction = async message => {
    const [, tokenAddr] = message.text.split(' ');
    const tokenAddress = tokenAddr.toLowerCase().trim();

    try {
      const userExists = await this.redisService.existsInSet('users', message.chatId.toString());

      if (!userExists) throw new BotError('User not found', 'Пользователь не найден', HttpStatus.NOT_FOUND);

      isEtherAddress(tokenAddress, 'Введите корректный адрес токена. Пример: /addtoken [адрес_токена]');

      await this.redisService.setUserField(message.chatId, 'tempToken', tokenAddress);

      const chainsArr = Object.entries(this.constants.chains);
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
    } catch (error) {
      return this.handleError(error, 'Error while adding token', 'Ошибка при добавлении токена');
    }
  };

  removeToken: TgCommandFunction = async message => {
    try {
      const [, tokenAddr] = message.text.split(' ');
      const tokenAddress = tokenAddr?.toLowerCase().trim();
      const userSession = await this.redisService.getUser(message.chatId);

      if (!userSession.tokens?.length) {
        throw new BotError('You have no saved tokens', 'У вас нет сохраненных токенов', HttpStatus.NOT_FOUND);
      }

      if (tokenAddress) {
        isEtherAddress(tokenAddress);
        await this.tokenService.removeToken({
          chatId: userSession.chatId,
          address: tokenAddress,
        });

        return { text: 'Токен успешно удален 🔥' };
      }

      const keyboard = userSession.wallets?.map(wallet => {
        const chain = this.constants.chains[wallet.network];
        return [{ text: `${chain.name}`, callback_data: `rm-${wallet.network}` }];
      });

      keyboard?.push([{ text: 'Все токены', callback_data: 'rm-all' }]);

      return {
        text: `Выберите действие:\n1. Удалить все токены\n2. Удалить все токены в выбранной сети`,
        options: {
          parse_mode: 'html',
          reply_markup: { inline_keyboard: keyboard },
        },
      };
    } catch (error) {
      return this.handleError(error, 'Error while removing token', 'Ошибка при удалении токена');
    }
  };

  getTokens: TgCommandFunction = async message => {
    try {
      const reply = await this.tokenService.getTokens(message.chatId);

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while getting tokens', 'Ошибка при получении токенов');
    }
  };

  getWallets: TgCommandFunction = async message => {
    try {
      const reply = await this.walletService.getWallets(message.chatId);

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while getting wallets', 'Ошибка при получении кошельков');
    }
  };

  subscribe: TgCommandFunction = async message => {
    try {
      const [, walletAddr] = message.text.split(' ');
      const walletAddress = walletAddr.toLowerCase().trim();

      isEtherAddress(walletAddress, 'Введите корректный адрес кошелька. Пример: /follow [адрес_кошелька]');

      await this.redisService.setUserField(message.chatId, 'tempWallet', walletAddress);

      const chainsArr = Object.entries(this.constants.chains);
      const keardboard = chainsArr.map(([keyNetwork, value]) => {
        return [{ text: `${value.exchange} (${keyNetwork})`, callback_data: `subnet-${keyNetwork}` }];
      });

      return {
        text: 'Выберите обменник, на котором вы хотите отслеживать транзакции данного кошелька:',
        options: {
          parse_mode: 'html',
          reply_markup: { inline_keyboard: keardboard },
        },
      };
    } catch (error) {
      return this.handleError(error, 'Error while subscribing to address', 'Ошибка при подписке на кошелек');
    }
  };

  unsubscribe: TgCommandFunction = async message => {
    try {
      const [, walletAddr] = message.text.split(' ');
      const walletAddress = walletAddr.toLowerCase().trim();

      isEtherAddress(walletAddress, 'Введите корректный адрес кошелька. Пример: /follow [адрес_кошелька]');

      await this.subscriptionService.unsubscribeFromWallet({
        chatId: message.chatId,
        walletAddress,
      });

      return { text: 'Вы успешно отписались от кошелька ✅', options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while unsubscribing from address', 'Ошибка при отписке от кошелька');
    }
  };

  getSubscriptions: TgCommandFunction = async message => {
    try {
      const reply = await this.subscriptionService.getSubscriptions(message.chatId);

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while getting subscriptions', 'Ошибка при получении подписок');
    }
  };

  replicate: TgCommandFunction = async message => {
    try {
      const [, action, limit] = message.text.split(' ');

      if (!strIsPositiveNumber(limit)) {
        throw new BotError(
          'Enter correct command',
          'Введите корректную команду. Пример: /replicate buy 100',
          HttpStatus.BAD_REQUEST,
        );
      }

      isBuySell(action);

      const userSession = await this.redisService.getUser(message.chatId);

      if (!userSession.subscriptions?.length) {
        throw new BotError('You have no subscriptions', 'У вас нет подписок на кошельки', HttpStatus.NOT_FOUND);
      }

      if (!userSession.tokens.length) {
        throw new BotError('You have no tokens', 'Сначала добавьте токены', HttpStatus.NOT_FOUND);
      }

      await this.redisService.setUserField(
        message.chatId,
        'tempReplication',
        JSON.stringify({ action, limit, chatId: message.chatId, userId: userSession.userId }),
      );

      const keyboard = userSession.subscriptions.map(sub => {
        return [{ text: `${sub.network}: ${sub.address}`, callback_data: `repl-${sub.id}-${sub.network}` }];
      });

      return {
        text: 'Выберите адрес подписки для установки параметров:',
        options: { reply_markup: { inline_keyboard: keyboard } },
      };
    } catch (error) {
      return this.handleError(
        error,
        'Error while setting replication params',
        'Ошибка при установке параметров повтора сделок',
      );
    }
  };

  getReplications: TgCommandFunction = async message => {
    try {
      const reply = await this.replicationService.getReplications(message.chatId);

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while getting replications', 'Ошибка при получении повторов сделок');
    }
  };

  getBalance: TgCommandFunction = async message => {
    try {
      const wallets = await this.redisService.getWallets(message.chatId);

      const keyboard = wallets?.map(wallet => {
        return [{ text: `${wallet.network}: ${wallet.address}`, callback_data: `balance-${wallet.id}` }];
      });

      return { text: 'Выберите кошелек:', options: { reply_markup: { inline_keyboard: keyboard } } };
    } catch (error) {
      return this.handleError(error, 'Error while getting balance', 'Ошибка при получении баланса');
    }
  };

  sendTokens: TgCommandFunction = async message => {
    try {
      const parts = message.text.split(' ');

      if (parts.length !== 3 && parts.length !== 4) {
        throw new BotError('Invalid format', 'Неверный формат команды', HttpStatus.BAD_REQUEST);
      }

      let tokenAddress: string | null = null;
      let amount: string;
      let recipientAddress: string;

      if (parts.length === 4) {
        [, tokenAddress, amount, recipientAddress] = parts;

        isEtherAddress(tokenAddress, 'Введите корректный адрес токена');
      } else {
        [, amount, recipientAddress] = parts;
      }

      isEtherAddress(recipientAddress, 'Введите корректный адрес получателя');

      if (!strIsPositiveNumber(amount)) {
        throw new BotError('Enter correct amount', 'Введите корректную сумму', HttpStatus.BAD_REQUEST);
      }

      await this.redisService.setUserField(
        message.chatId,
        'tempSendTokens',
        `${tokenAddress || TokenAddressType.NATIVE}:${amount}:${recipientAddress}`,
      );

      const networks = Object.entries(this.constants.chains);
      const keyboard = networks.map(([network, value]) => {
        return [{ text: `${value.name}`, callback_data: `send-${network}` }];
      });

      return {
        text: 'Выберите сеть:',
        options: { reply_markup: { inline_keyboard: keyboard } },
      };
    } catch (error) {
      return this.handleError(error, 'Error while sending tokens', 'Ошибка при отправке токенов');
    }
  };

  handleError(error: unknown, errMsg: string, userMsg: string): { text: string; options?: TgSendMessageOptions } {
    this.logger.error(`${errMsg}`, error);

    if (error instanceof BotError) {
      return { text: error.userMessage, options: { parse_mode: 'html' } };
    }

    return { text: userMsg, options: { parse_mode: 'html' } };
  }

  private fakeSwapTo: TgCommandFunction = async message => {
    if (this.constants.NODE_ENV === 'production') {
      return { text: 'Неизвестная команда, попробуйте /help' };
    }

    try {
      const testTokens = await this.redisService.getTokens(message.chatId, 'testTokens');

      if (!testTokens?.length) {
        throw new BotError(
          'You have no tokens',
          'У вас нет токенов, чтобы отправить транзакцию',
          HttpStatus.BAD_REQUEST,
        );
      }

      const testToken = testTokens[0];

      if (!testToken) throw new BotError('Token not found', 'Токен не найден', HttpStatus.NOT_FOUND);

      await this.blockchainService.fakeSwapTo(testToken);

      return { text: 'Транзакция отправлена', options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while sending fake transaction', 'Ошибка при отправке транзакции');
    }
  };

  private fakeSwapFrom: TgCommandFunction = async message => {
    if (this.constants.NODE_ENV === 'production') {
      return { text: 'Неизвестная команда, попробуйте /help' };
    }

    try {
      const testTokens = await this.redisService.getTokens(message.chatId, 'testTokens');

      if (!testTokens?.length) {
        throw new BotError(
          'You have no tokens',
          'У вас нет токенов, чтобы отправить транзакцию',
          HttpStatus.BAD_REQUEST,
        );
      }
      const testToken = testTokens[0];

      if (!testToken) throw new BotError('Token not found', 'Токен не найден', HttpStatus.NOT_FOUND);
      await this.blockchainService.fakeSwapFrom(testToken);

      return { text: 'Транзакция отправлена', options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while sending fake transaction', 'Ошибка при отправке транзакции');
    }
  };
}
