import { Address } from 'viem';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEthereumAddress } from 'class-validator';

import { UserService } from '@modules/user/user.service';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { chains, helpMessage, startMessage } from '@src/utils/constants';
import { IncomingMessage, SendMessageOptions } from '@src/types/types';

@Injectable()
export class CommandHandler {
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {}

  async handleCommand(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    const command = message.text;

    switch (true) {
      case command.startsWith('/start'):
        return { text: startMessage };
      case command.startsWith('/help'):
        return { text: helpMessage };
      case command.startsWith('/addtoken'):
        return this.addToken(message);
      case command.startsWith('/removetoken'):
        return this.removeToken(message);
      case command.startsWith('/balance'):
        return this.getBalance(message);
      default:
        return { text: 'Неизвестная команда. Попробуйте /help.' };
    }
  }

  private async addToken(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    const [, tokenAddress] = message.text.split(' ');

    try {
      const userSession = await this.redisService.getSessionData(message.chatId.toString());

      if (!userSession) throw new Error('Пользователь не найден');

      if (!tokenAddress || !isEthereumAddress(tokenAddress)) {
        throw new Error('Введите корректный адрес токена. Пример: /addtoken [адрес_токена]');
      }

      await this.redisService.setSessionData(message.chatId.toString(), {
        ...userSession,
        tempToken: tokenAddress,
      });

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
    const [, tokenAddress] = message.text.split(' ');

    try {
      const userSession = await this.redisService.getSessionData(message.chatId.toString());

      if (!userSession) throw new Error('Пользователь не найден');

      if (!userSession.tokens?.length) {
        throw new Error('У вас нет сохраненных токенов');
      }

      if (tokenAddress) {
        const deletedToken = await this.userService.removeToken({
          userId: userSession.userId,
          chatId: userSession.chatId,
          address: tokenAddress as Address,
        });

        if (!deletedToken.affected) throw new Error('Токен не найден');

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

  private async getBalance(message: IncomingMessage): Promise<{ text: string; options?: SendMessageOptions }> {
    const [, walletAddress] = message.text.split(' ');
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    try {
      const userSession = await this.redisService.getSessionData(message.chatId.toString());
      if (!userSession) throw new Error('Пользователь не найден');

      // TODO: может лучше устанавливать тестовый баланс при добавлении пользователя в сессию
      if (walletAddress && nodeEnv !== 'production') {
        const wallet = userSession.wallets?.find(wallet => wallet.address === walletAddress);
        if (!wallet) throw new Error('Кошелек не найден');

        const balance = await this.blockchainService.setTestBalance({
          chatId: message.chatId,
          network: wallet?.network,
          address: wallet.address as Address,
        });

        return { text: balance, options: { parse_mode: 'html' } };
      }

      const keyboard = userSession.wallets?.map(wallet => {
        return [{ text: `${wallet.network}: ${wallet.address}`, callback_data: `balance-${wallet.id}` }];
      });

      return { text: 'Выберите кошелек:', options: { reply_markup: { inline_keyboard: keyboard } } };
    } catch (error) {
      console.log(`Error while removing token: ${error.message}`);
      return { text: `${error.message}` };
    }
  }
}
