import { Module } from '@nestjs/common';

import { UserModule } from '@modules/user/user.module';
import { RedisModule } from '@modules/redis/redis.module';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { BotService } from './bot.service';
import { TelegramBot } from './telegram/telegram-bot';
import { BotProvider } from './bot.provider';
import { CommandHandler } from './utils/command-handler';
import { MessageHandler } from './utils/message-handler';

@Module({
  imports: [UserModule, RedisModule, BlockchainModule],
  providers: [
    BotService,
    BotProvider,
    TelegramBot,
    MessageHandler,
    CommandHandler,
    {
      provide: 'TelegramBotProvider',
      useFactory: (telegramBot: TelegramBot, messageHandler: MessageHandler, commandHandler: CommandHandler) =>
        new BotProvider(telegramBot, messageHandler, commandHandler),
      inject: [TelegramBot, MessageHandler, CommandHandler],
    },
  ],
  exports: [BotService, 'TelegramBotProvider'],
})
export class BotModule {}
