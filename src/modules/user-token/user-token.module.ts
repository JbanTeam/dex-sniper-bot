import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserToken } from './user-token.entity';
import { RedisModule } from '@modules/redis/redis.module';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { UserTokenService } from './user-token.service';
@Module({
  imports: [TypeOrmModule.forFeature([UserToken]), BlockchainModule, RedisModule],
  providers: [UserTokenService],
  exports: [UserTokenService],
})
export class UserTokenModule {}
