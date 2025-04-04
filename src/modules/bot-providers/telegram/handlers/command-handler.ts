import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { UserService } from '@modules/user/user.service';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { IncomingMessage, SendMessageOptions } from '@src/types/types';
import { SubscriptionService } from '@modules/subscription/subscription.service';
import { chains, helpMessage, startMessage } from '@src/utils/constants';
import { isBuySell, isEtherAddress } from '@src/types/typeGuards';
import { strIsPositiveNumber } from '@src/utils/utils';

@Injectable()
export class CommandHandler {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly blockchainService: BlockchainService,
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  async handleCommand(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    const command = message.text;

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
      case command.startsWith('/faketransaction'):
        return this.sendFakeTransaction(message);
      case command.startsWith('/help'):
        return { text: helpMessage };
      default:
        return { text: 'Неизвестная команда. Попробуйте /help.' };
    }
  }

  private async addToken(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    const [, tokenAddress] = message.text.split(' ');

    try {
      const userId = await this.redisService.getUserId(message.chatId);

      if (!userId) throw new Error('Пользователь не найден');

      isEtherAddress(tokenAddress, 'Введите корректный адрес токена. Пример: /addtoken [адрес_токена]');

      await this.redisService.setUserField(message.chatId, 'tempToken', tokenAddress);

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
    } catch (error) {
      console.log(`Error while removing token: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async removeToken(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const [, tokenAddress] = message.text.split(' ');
      const userSession = await this.redisService.getUser(message.chatId);

      if (!userSession.tokens?.length) {
        throw new Error('У вас нет сохраненных токенов');
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
        const network = chains(this.configService)[wallet.network];
        return [{ text: `${network.name}`, callback_data: `rm-${wallet.network}` }];
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
      return { text: `${error.message}` };
    }
  }

  private async subscribe(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const [, walletAddress] = message.text.split(' ');

      isEtherAddress(walletAddress, 'Введите корректный адрес кошелька. Пример: /follow [адрес_кошелька]');

      await this.redisService.setUserField(message.chatId, 'tempWallet', walletAddress);

      const chainsArr = Object.entries(chains(this.configService));
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
      return { text: `${error.message}` };
    }
  }

  private async unsubscribe(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
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
      return { text: `${error.message}` };
    }
  }

  private async getSubscriptions(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const reply = await this.subscriptionService.getSubscriptions(message.chatId);

      return { text: reply, options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while getting subscriptions: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async replicate(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const [, action, limit] = message.text.split(' ');

      if (!strIsPositiveNumber(limit)) throw new Error('Введите корректную команду. Пример: /replicate buy 100');

      isBuySell(action);

      await this.redisService.setUserField(message.chatId, 'tempReplication', `${action}:${limit}`);

      const subscriptions = await this.redisService.getSubscriptions(message.chatId);

      if (!subscriptions?.length) {
        throw new Error('У вас нет подписок на кошельки');
      }

      const keyboard = subscriptions.map(sub => {
        return [{ text: `${sub.network}: ${sub.address}`, callback_data: `sub-${sub.id}` }];
      });

      return {
        text: 'Выберите адрес подписки для установки параметров:',
        options: { reply_markup: { inline_keyboard: keyboard } },
      };
    } catch (error) {
      console.log(`Error while subscribing to address: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async getBalance(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const [, walletAddress] = message.text.split(' ');
      const nodeEnv = this.configService.get<string>('NODE_ENV');
      const wallets = await this.redisService.getWallets(message.chatId);

      // TODO: ?
      if (walletAddress && nodeEnv !== 'production') {
        const wallet = wallets?.find(wallet => wallet.address === walletAddress);
        if (!wallet) throw new Error('Кошелек не найден');

        const balance = await this.blockchainService.setTestBalance({
          chatId: message.chatId,
          network: wallet.network,
          address: wallet.address,
        });

        return { text: balance, options: { parse_mode: 'html' } };
      }

      const keyboard = wallets?.map(wallet => {
        return [{ text: `${wallet.network}: ${wallet.address}`, callback_data: `balance-${wallet.id}` }];
      });

      return { text: 'Выберите кошелек:', options: { reply_markup: { inline_keyboard: keyboard } } };
    } catch (error) {
      console.log(`Error while removing token: ${error.message}`);
      return { text: `${error.message}` };
    }
  }

  private async sendFakeTransaction(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    try {
      const testTokens = await this.redisService.getTestTokens(message.chatId);

      if (!testTokens || !testTokens?.length) {
        throw new Error('У вас нет токенов, чтобы отправить транзакцию');
      }
      const contractAddress = testTokens[0].address;

      if (!contractAddress) throw new Error('Токен не найден');
      await this.blockchainService.sendFakeTransaction(contractAddress);

      return { text: 'Транзакция отправлена', options: { parse_mode: 'html' } };
    } catch (error) {
      console.log(`Error while sending fake transaction: ${error.message}`);
      return { text: `${error.message}` };
    }
  }
}
