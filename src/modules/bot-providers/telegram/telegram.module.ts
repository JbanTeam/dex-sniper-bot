import { Module } from '@nestjs/common';

import { TelegramService } from './telegram.service';
import { UserModule } from '@modules/user/user.module';
import { RedisModule } from '@modules/redis/redis.module';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';

@Module({
  imports: [UserModule, RedisModule, BlockchainModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
