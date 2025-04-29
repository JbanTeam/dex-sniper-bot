import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '@modules/redis/redis.module';
import { SubscriptionService } from './subscription.service';
import { Subscription } from './subscription.entity';
import { Replication } from './replication.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Replication]), RedisModule],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
