import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { databaseConfig } from './config/database.config';

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
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}
