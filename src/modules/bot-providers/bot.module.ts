import { Module } from '@nestjs/common';

import { UserModule } from '@modules/user/user.module';
import { RedisModule } from '@modules/redis/redis.module';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { BotService } from './bot.service';
import { TelegramBot } from './telegram/telegram-bot';
import { BotProvider } from './bot.provider';
import { CommandHandler } from './telegram/handlers/command-handler';
import { MessageHandler } from './telegram/handlers/message-handler';
import { QueryHandler } from './telegram/handlers/query-handler';
import { SubscriptionModule } from '@modules/subscription/subscription.module';
import { WalletModule } from '@modules/wallet/wallet.module';

@Module({
  imports: [UserModule, RedisModule, BlockchainModule, SubscriptionModule, WalletModule],
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
