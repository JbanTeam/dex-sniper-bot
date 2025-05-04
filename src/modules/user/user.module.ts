import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './user.entity';
import { UserService } from './user.service';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { RedisModule } from '@modules/redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), BlockchainModule, RedisModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
