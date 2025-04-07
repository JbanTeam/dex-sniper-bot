import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { UserModule } from './modules/user/user.module';
import { RedisModule } from './modules/redis/redis.module';
import { BotModule } from '@modules/bot-providers/bot.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConstantsModule } from '@modules/constants/constants.module';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { ConstantsProvider } from '@modules/constants/constants.provider';

const envPath =
  process.env.NODE_ENV === 'development' ? '.env.dev' : process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: envPath,
      isGlobal: true,
    }),
    ConstantsModule,
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConstantsProvider],
      useFactory: (constants: ConstantsProvider) => {
        return constants.databaseConfig;
      },
    }),
    UserModule,
    BlockchainModule,
    BotModule,
    RedisModule,
  ],
})
export class AppModule {}
