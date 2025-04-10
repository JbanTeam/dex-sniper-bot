import { Injectable } from '@nestjs/common';

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
import { TgCommandFunction, TgCommandReturnType } from '../types/types';

@Injectable()
export class TgCommandHandler extends BaseCommandHandler<IncomingMessage, TgCommandReturnType> {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly blockchainService: BlockchainService,
    private readonly subscriptionService: SubscriptionService,
    private readonly constants: ConstantsProvider,
  ) {
    super();
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
      console.log(`Error while adding token: ${error.message}`);
      throw error;
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
      console.log(`Error while removing token: ${error.message}`);
      throw error;
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
      console.log(`Error while subscribing to address: ${error.message}`);
      throw error;
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
      console.log(`Error while unsubscribing from address: ${error.message}`);
      throw error;
    }
  };

  getSubscriptions: TgCommandFunction = async message => {
    try {
      const reply = await this.subscriptionService.getSubscriptions(message.chatId);

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while getting subscriptions: ${error.message}`);
      throw error;
    }
  };

  replicate: TgCommandFunction = async message => {
    try {
      const [, action, limit] = message.text.split(' ');

      if (!strIsPositiveNumber(limit)) {
        throw new BotError('Enter correct command', 'Введите корректную команду. Пример: /replicate buy 100', 400);
      }

      isBuySell(action);

      await this.redisService.setUserField(message.chatId, 'tempReplication', `${action}:${limit}`);

      const subscriptions = await this.redisService.getSubscriptions(message.chatId);

      if (!subscriptions?.length) {
        throw new BotError('You have no subscriptions', 'У вас нет подписок на кошельки', 404);
      }

      const keyboard = subscriptions.map(sub => {
        return [{ text: `${sub.network}: ${sub.address}`, callback_data: `sub-${sub.id}` }];
      });

      return {
        text: 'Выберите адрес подписки для установки параметров:',
        options: { reply_markup: { inline_keyboard: keyboard } },
      };
    } catch (error) {
      console.log(`Error while setting replication params: ${error.message}`);
      throw error;
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
      console.log(`Error while getting balance: ${error.message}`);
      throw error;
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
      console.log(`Error while sending tokens: ${error.message}`);
      throw error;
    }
  };

  sendFakeTransaction: TgCommandFunction = async message => {
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
      console.log(`Error while sending fake transaction: ${error.message}`);
      throw error;
    }
  };
}
