import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { dataSourceConfig } from './dataSourceBase';

dotenv.config();

const configService = new ConfigService();

const AppDataSource = new DataSource(dataSourceConfig(configService));

export default AppDataSource;
