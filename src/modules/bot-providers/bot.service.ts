import { Injectable, OnModuleInit } from '@nestjs/common';

import { BotProviderInterface } from '@src/types/types';
import { TelegramBot } from './telegram/telegram-bot';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly bots: BotProviderInterface[] = [];
  constructor(private readonly telegramBot: TelegramBot) {
    this.bots.push(this.telegramBot);
  }

  onModuleInit() {
    this.start();
  }

  start() {
    for (const bot of this.bots) {
      bot.start().catch(err => {
        console.log(err);
      });
    }
  }
}
