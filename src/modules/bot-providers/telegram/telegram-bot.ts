import axios from 'axios';
import { Injectable, NotFoundException } from '@nestjs/common';

import { RedisService } from '@modules/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '@modules/user/user.service';
import { CallbackQuery, Message, TelegramUpdateResponse } from './utils/types';
import { BotProviderInterface, IncomingMessage, SendMessageOptions, IncomingQuery } from '@src/types/types';

@Injectable()
export class TelegramBot implements BotProviderInterface {
  private TG_URL: string = 'https://api.telegram.org/bot';

  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.TG_URL += token;
    this.setCommands().catch(console.error);
  }

  async sendMessage({
    chatId,
    text,
    options = {},
  }: {
    chatId: number;
    text: string;
    options?: SendMessageOptions;
  }): Promise<void> {
    const url = `${this.TG_URL}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: chatId,
        text: text,
        parse_mode: options.parse_mode || 'html',
        ...options,
      });
    } catch (error) {
      console.log('Error while sending message:', error);
      throw error;
    }
  }

  async deleteMessage({ chatId, messageId }: { chatId: number; messageId: number }): Promise<void> {
    const url = `${this.TG_URL}/deleteMessage`;
    try {
      await axios.post(url, {
        chat_id: chatId,
        message_id: messageId,
      });
    } catch (error) {
      console.log('Error while deleting message:', error);
      throw error;
    }
  }

  async onMessage(callback: (message: IncomingMessage | IncomingQuery) => Promise<void>): Promise<void> {
    let offset = 0;

    while (true) {
      const url = `${this.TG_URL}/getUpdates?offset=${offset}&allowed_updates=["message", "callback_query"]`;
      const response = await axios.get(url);

      const data: TelegramUpdateResponse = response.data as TelegramUpdateResponse;

      try {
        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            if (update.message) {
              const message = this.parseMessage(update.message);
              await this.middlewares(update.message);
              await callback(message);
            } else if (update.callback_query) {
              const query = this.parseQuery(update.callback_query);
              await callback(query);
            }
            offset = update.update_id + 1;
          }
        }
      } catch (error) {
        console.log('Error while processing updates:', error);
        throw error;
      }
    }
  }

  private parseMessage(message: Message): IncomingMessage {
    return {
      chatId: message.chat.id,
      text: message.text || '',
      messageId: message.message_id,
      timestamp: new Date(message.date * 1000),
      user: {
        id: message.from?.id || 0,
        username: message.from?.username,
      },
    };
  }

  private parseQuery(query: CallbackQuery): IncomingQuery {
    return {
      query_id: query.id,
      chatId: query?.message?.chat.id || 0,
      data: query.data || '',
      messageId: query.message?.message_id || 0,
      timestamp: query.message?.date ? new Date(query?.message?.date * 1000) : new Date(),
      user: {
        id: query.message?.from?.id || 0,
        username: query.message?.from?.username || '',
      },
    };
  }

  async setCommands(): Promise<void> {
    const commands = [
      { command: 'start', description: ' Приветствие, функциональность' },
      { command: 'help', description: 'Помощь' },
      { command: 'addtoken', description: 'Добавить токен, /addtoken [адрес_токена]' },
      { command: 'removetoken', description: 'Удалить токены, /removetoken [адрес_токена] - удалить токен' },
      { command: 'balance', description: 'Посмотреть баланс' },
      { command: 'my_subscribes', description: 'Посмотреть мои подписки' },
    ];

    const url = `${this.TG_URL}/setMyCommands`;
    const body = {
      commands,
      scope: { type: 'all_private_chats' },
      language_code: 'ru',
    };

    try {
      const response = await axios.post(url, body);

      if (!response.data.ok) {
        throw new Error('Failed to set commands');
      }

      console.log('Commands set successfully:', response.data);
    } catch (error) {
      console.error('Error setting commands:', error);
      throw error;
    }
  }

  private async middlewares(message: Message): Promise<void> {
    if (!message.from || !message.chat) return;

    const chatId = message.chat.id;
    const telegramUserId = message.from.id;

    const userSession = await this.redisService.getSessionData(chatId.toString());

    if (userSession?.chatId === chatId && userSession?.telegramUserId === telegramUserId) {
      await this.redisService.setSessionData(chatId.toString(), { ...userSession, action: 'get' });
      userSession.action = 'get';
      return;
    }

    const { user, action } = await this.userService.getOrCreateUser({
      chatId,
      telegramUserId,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.wallets.forEach(wallet => {
      if (wallet.encryptedPrivateKey) {
        wallet.encryptedPrivateKey = '';
      }
    });

    await this.redisService.setSessionData(chatId.toString(), {
      chatId,
      telegramUserId,
      userId: user.id,
      action,
      wallets: [...user.wallets],
    });
  }
}
