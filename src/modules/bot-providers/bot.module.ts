import { Module } from '@nestjs/common';

import { UserModule } from '@modules/user/user.module';
import { RedisModule } from '@modules/redis/redis.module';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { BotService } from './bot.service';
import { SubscriptionModule } from '@modules/subscription/subscription.module';
import { WalletModule } from '@modules/wallet/wallet.module';
import { TelegramBot } from './telegram/telegram-bot';
import { TgCommandHandler } from './telegram/handlers/TgCommandHandler';
import { TgQueryHandler } from './telegram/handlers/TgQueryHandler';
import { TgMessageHandler } from './telegram/handlers/TgMessageHandler';

@Module({
  imports: [UserModule, RedisModule, BlockchainModule, SubscriptionModule, WalletModule],
  providers: [BotService, TelegramBot, TgCommandHandler, TgQueryHandler, TgMessageHandler],
  exports: [BotService],
})
export class BotModule {}
