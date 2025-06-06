import { DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

export const dataSourceConfig = (configService: ConfigService): DataSourceOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: Number(configService.get<string>('DB_PORT')),
  username: configService.get<string>('DB_USER'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME'),
  synchronize: false,
  entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../../db/migrations/*{.ts,.js}'],
  migrationsRun: false,
  logging: true,
});
