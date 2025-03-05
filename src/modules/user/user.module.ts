import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserService } from './user.service';
import { User } from './user.entity';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { UserToken } from './user-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserToken]), BlockchainModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
