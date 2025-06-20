import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RedisModule } from '@modules/redis/redis.module';
import { SubscriptionService } from './subscription.service';
import { Subscription } from './subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription]), RedisModule],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
