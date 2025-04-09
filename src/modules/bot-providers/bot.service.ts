import { Injectable, OnModuleInit } from '@nestjs/common';

import { BotError } from '@src/errors/BotError';
import { BotProviderInterface } from '@src/types/types';
import { TelegramBot } from './telegram/telegram-bot';

@Injectable()
export class BotService implements OnModuleInit {
  private bots: BotProviderInterface[] = [];
  constructor(private readonly telegramBot: TelegramBot) {
    this.bots.push(this.telegramBot);
  }

  onModuleInit() {
    this.start();
  }

  start() {
    for (const bot of this.bots) {
      bot.start().catch(async err => {
        console.error(err);
        if (err instanceof BotError && err.incomingMessage) {
          const message = err.incomingMessage;

          if ('data' in message) {
            await bot.deleteMessage({ chatId: message.chatId, messageId: message.messageId });
          }

          await bot.sendMessage({ chatId: message.chatId, text: err.userMessage });
        }
      });
    }
  }
}
