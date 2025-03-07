import axios from 'axios';
import { Injectable } from '@nestjs/common';

import { RedisService } from '@modules/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { BotProviderInterface, IncomingMessage, TelegramUpdateResponse, TelegramUpdate } from '@src/types/types';

@Injectable()
export class TelegramBot implements BotProviderInterface {
  private TG_URL: string = 'https://api.telegram.org/bot';

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.TG_URL += token;
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    const url = `${this.TG_URL}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: chatId,
        text: text,
        parse_mode: 'html',
      });
    } catch (error) {
      console.log('Error while sending message:', error);
      throw error;
    }
  }

  async onMessage(callback: (message: IncomingMessage) => Promise<void>): Promise<void> {
    let offset = 0;

    while (true) {
      const url = `${this.TG_URL}/getUpdates?offset=${offset}&allowed_updates=["message", "callback_query"]`;
      const response = await axios.get(url);

      const data: TelegramUpdateResponse = response.data as TelegramUpdateResponse;

      try {
        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            const message = this.parseMessage(update);
            await callback(message);
            offset = update.update_id + 1;
          }
        }
      } catch (error) {
        console.log('Error while processing updates:', error);
        throw error;
      }
    }
  }

  private parseMessage(update: TelegramUpdate): IncomingMessage {
    const { message } = update;

    return {
      chatId: message.chat.id,
      text: message.text,
      timestamp: new Date(message.date * 1000),
      user: {
        id: message.from.id,
        username: message.from.username,
      },
    };
  }
}
