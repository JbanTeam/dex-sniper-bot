import { Module } from '@nestjs/common';

import { UserModule } from '@modules/user/user.module';
import { RedisModule } from '@modules/redis/redis.module';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { BotService } from './bot.service';
import { TelegramBot } from './telegram/telegram-bot';
import { BotProvider } from './bot.provider';
import { CommandHandler } from './telegram/utils/command-handler';
import { MessageHandler } from './telegram/utils/message-handler';
import { QueryHandler } from './telegram/utils/query-handler';

@Module({
  imports: [UserModule, RedisModule, BlockchainModule],
  providers: [
    BotService,
    BotProvider,
    TelegramBot,
    MessageHandler,
    CommandHandler,
    QueryHandler,
    {
      provide: 'TelegramBotProvider',
      useFactory: (
        telegramBot: TelegramBot,
        messageHandler: MessageHandler,
        commandHandler: CommandHandler,
        queryHandler: QueryHandler,
      ) => new BotProvider(telegramBot, messageHandler, commandHandler, queryHandler),
      inject: [TelegramBot, MessageHandler, CommandHandler, QueryHandler],
    },
  ],
  exports: [BotService, 'TelegramBotProvider'],
})
export class BotModule {}
