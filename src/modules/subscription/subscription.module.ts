import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserModule } from '@modules/user/user.module';
import { RedisModule } from '@modules/redis/redis.module';
import { SubscriptionService } from './subscription.service';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { Subscription } from './subscription.entity';
import { User } from '@modules/user/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Subscription]), UserModule, RedisModule, BlockchainModule],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
