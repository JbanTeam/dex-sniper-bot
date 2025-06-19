import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { dataSourceConfig } from './dataSourceBase';

dotenv.config({ path: '.env.dev' });

const configService = new ConfigService();

const config = {
  ...dataSourceConfig(configService),
  host: 'localhost',
};

const AppDataSource = new DataSource(config);

export default AppDataSource;
