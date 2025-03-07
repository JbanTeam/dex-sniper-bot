import { ConfigService } from '@nestjs/config';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';

import { BotProvider } from './bot.provider';
import { UserService } from '@modules/user/user.service';
import { RedisService } from '@modules/redis/redis.service';
import { BlockchainService } from '@modules/blockchain/blockchain.service';

@Injectable()
export class BotService implements OnModuleInit {
  private bots: BotProvider[] = [];
  constructor(
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly blockchainService: BlockchainService,
    @Inject('TelegramBotProvider') private readonly telegramBot: BotProvider,
  ) {
    this.bots.push(this.telegramBot);
  }

  onModuleInit() {
    this.start();
  }

  start() {
    for (const bot of this.bots) {
      bot.start().catch(console.error);
    }
  }
}
