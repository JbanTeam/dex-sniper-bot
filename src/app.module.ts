import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { databaseConfig } from './config/database.config';
import { UserModule } from './modules/user/user.module';
import { TelegramModule } from './modules/bot-providers/telegram/telegram.module';
import { RedisModule } from './modules/redis/redis.module';

const envPath =
  process.env.NODE_ENV === 'development' ? '.env.dev' : process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: envPath, isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return databaseConfig(configService);
      },
    }),
    UserModule,
    TelegramModule,
    RedisModule,
  ],
})
export class AppModule {}
