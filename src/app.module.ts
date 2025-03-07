import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { databaseConfig } from './config/database.config';
import { UserModule } from './modules/user/user.module';
import { RedisModule } from './modules/redis/redis.module';
import { BotModule } from '@modules/bot-providers/bot.module';

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
    BotModule,
    RedisModule,
  ],
})
export class AppModule {}
