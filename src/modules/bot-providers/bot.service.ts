import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { BotProvider } from './bot.provider';
import { BotError } from '@src/errors/BotError';

@Injectable()
export class BotService implements OnModuleInit {
  private bots: BotProvider[] = [];
  constructor(@Inject('TelegramBotProvider') private readonly telegramBot: BotProvider) {
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
            await bot.deleteMessage(message.chatId, message.messageId);
          }

          await bot.sendMessage({ chatId: message.chatId, text: err.userMessage });
        }
      });
    }
  }
}
