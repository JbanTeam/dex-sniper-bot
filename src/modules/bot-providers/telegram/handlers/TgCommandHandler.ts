import { Injectable, Logger } from '@nestjs/common';

import { BotError } from '@src/errors/BotError';
import { UserService } from '@modules/user/user.service';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { strIsPositiveNumber } from '@src/utils/utils';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { IncomingMessage } from '@src/types/types';
import { BaseCommandHandler } from '@modules/bot-providers/handlers/BaseCommandHandler';
import { helpMessage, startMessage } from '@src/utils/constants';
import { isBuySell, isEtherAddress } from '@src/types/typeGuards';
import { TgCommandFunction, TgCommandReturnType, TgSendMessageOptions } from '../types/types';

@Injectable()
export class TgCommandHandler extends BaseCommandHandler<IncomingMessage, TgCommandReturnType> {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly blockchainService: BlockchainService,
    private readonly subscriptionService: SubscriptionService,
    private readonly constants: ConstantsProvider,
  ) {
    const logger = new Logger(TgCommandHandler.name);
    super(logger);
  }

  handleCommand: TgCommandFunction = async message => {
    const command = message.text.trim();

    switch (true) {
      case command.startsWith('/start'):
        return { text: startMessage };
      case command.startsWith('/addtoken'):
        return this.addToken(message);
      case command.startsWith('/removetoken'):
        return this.removeToken(message);
      case command.startsWith('/mytokens'):
        return this.getTokens(message);
      case command.startsWith('/balance'):
        return this.getBalance(message);
      case command.startsWith('/follow'):
        return this.subscribe(message);
      case command.startsWith('/unfollow'):
        return this.unsubscribe(message);
      case command.startsWith('/replicate'):
        return this.replicate(message);
      case command.startsWith('/subscriptions'):
        return this.getSubscriptions(message);
      case command.startsWith('/send'):
        return this.sendTokens(message);
      case command.startsWith('/faketransaction'):
        return this.sendFakeTransaction(message);
      case command.startsWith('/help'):
        return { text: helpMessage };
      default:
        return { text: 'Неизвестная команда. Попробуйте /help.' };
    }
  };

  addToken: TgCommandFunction = async message => {
    const [, tokenAddress] = message.text.split(' ');

    try {
      const userExists = await this.redisService.existsInSet('users', message.chatId.toString());

      if (!userExists) throw new BotError('User not found', 'Пользователь не найден', 404);

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
      const [, tokenAddress] = message.text.split(' ');
      const userSession = await this.redisService.getUser(message.chatId);

      if (!userSession.tokens?.length) {
        throw new BotError('You have no saved tokens', 'У вас нет сохраненных токенов', 404);
      }

      if (tokenAddress) {
        isEtherAddress(tokenAddress);
        await this.userService.removeToken({
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
        text: `Выберите действие:\n1. Удалить <u>все</u> токены\n2. Удалить <u>все</u> токены в выбранной сети`,
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
      const reply = await this.userService.getTokens(message.chatId);

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while getting tokens', 'Ошибка при получении токенов');
    }
  };

  subscribe: TgCommandFunction = async message => {
    try {
      const [, walletAddress] = message.text.split(' ');

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
      const [, walletAddress] = message.text.split(' ');

      isEtherAddress(walletAddress, 'Введите корректный адрес кошелька. Пример: /follow [адрес_кошелька]');

      await this.subscriptionService.unsubscribeFromWallet({
        chatId: message.chatId,
        walletAddress,
      });

      return {
        text: 'Вы успешно отписались от кошелька ✅',
        options: {
          parse_mode: 'html',
        },
      };
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
        throw new BotError('Enter correct command', 'Введите корректную команду. Пример: /replicate buy 100', 400);
      }

      isBuySell(action);

      const userSession = await this.redisService.getUser(message.chatId);

      if (!userSession.subscriptions?.length) {
        throw new BotError('You have no subscriptions', 'У вас нет подписок на кошельки', 404);
      }

      if (!userSession.tokens.length) {
        throw new BotError('You have no tokens', 'Сначала добавьте токены', 404);
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
      const [, tokenAddress, amount, recipientAddress] = message.text.split(' ');

      isEtherAddress(tokenAddress, 'Введите корректный адрес токена');
      isEtherAddress(recipientAddress, 'Введите корректный адрес получателя');
      if (!strIsPositiveNumber(amount)) {
        throw new BotError('Enter correct amount of tokens', 'Введите корректное количество токенов', 400);
      }

      await this.redisService.setUserField(
        message.chatId,
        'tempSendTokens',
        `${tokenAddress}:${amount}:${recipientAddress}`,
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

  private sendFakeTransaction: TgCommandFunction = async message => {
    if (this.constants.NODE_ENV === 'production') {
      return { text: 'Неизвестная команда, попробуйте /help' };
    }

    try {
      const testTokens = await this.redisService.getTokens(message.chatId, 'testTokens');

      if (!testTokens?.length) {
        throw new BotError('You have no tokens', 'У вас нет токенов, чтобы отправить транзакцию', 400);
      }
      const testToken = testTokens[0];

      if (!testToken) throw new BotError('Token not found', 'Токен не найден', 404);
      await this.blockchainService.sendFakeTransaction(testToken);

      return { text: 'Транзакция отправлена', options: { parse_mode: 'html' } };
    } catch (error) {
      return this.handleError(error, 'Error while sending fake transaction', 'Ошибка при отправке транзакции');
    }
  };
}
