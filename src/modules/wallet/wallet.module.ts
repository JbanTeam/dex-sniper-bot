import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WalletService } from './wallet.service';
import { Wallet } from './wallet.entity';
import { RedisModule } from '@modules/redis/redis.module';
@Module({
  imports: [TypeOrmModule.forFeature([Wallet]), RedisModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
