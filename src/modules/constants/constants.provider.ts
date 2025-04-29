import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { bsc, polygon } from 'viem/chains';

import { Address, ChainsType, Network } from '@src/types/types';

@Injectable()
export class ConstantsProvider {
  public readonly NODE_ENV: string;
  public readonly PORT: string;
  public readonly DB_USER: string;
  public readonly DB_PASSWORD: string;
  public readonly DB_NAME: string;
  public readonly DB_HOST: string;
  public readonly DB_PORT: string;
  public readonly DATABASE_URL: string;
  public readonly REDIS_PORT: string;
  public readonly REDIS_HOST: string;
  public readonly REDIS_DB: string;
  public readonly REDIS_USERNAME: string;
  public readonly REDIS_PASSWORD: string;
  public readonly PGADMIN_PORT: string;
  public readonly PGADMIN_EMAIL: string;
  public readonly PGADMIN_PASSWORD: string;
  public readonly TELEGRAM_BOT_TOKEN: string;
  public readonly ENCRYPT_KEY: string;
  public readonly ANVIL_RPC_URL: string;
  public readonly ANVIL_WS_RPC_URL: string;
  public readonly POLYGON_RPC_URL: string;
  public readonly POLYGON_WS_RPC_URL: string;
  public readonly BSC_RPC_URL: string;
  public readonly BSC_WS_RPC_URL: string;

  public readonly notProd: boolean;
  public readonly chains: ChainsType;
  public readonly anvilAddresses: { exchangeAddress: Address; recipientAddress: Address } = {
    exchangeAddress: '0x',
    recipientAddress: '0x',
  };
  public readonly databaseConfig: TypeOrmModuleOptions;

  constructor(private readonly configService: ConfigService) {
    this.NODE_ENV = this.getConfigValue('NODE_ENV', 'development');
    this.PORT = this.getConfigValue('PORT', '3000');
    this.DB_USER = this.getConfigValue('DB_USER', 'postgres');
    this.DB_PASSWORD = this.getConfigValue('DB_PASSWORD', 'password');
    this.DB_NAME = this.getConfigValue('DB_NAME', 'dex_db_dev');
    this.DB_HOST = this.getConfigValue('DB_HOST', 'db');
    this.DB_PORT = this.getConfigValue('DB_PORT', '5432');
    this.DATABASE_URL = this.getConfigValue('DATABASE_URL', '');
    this.REDIS_HOST = this.getConfigValue('REDIS_HOST', 'localhost');
    this.REDIS_PORT = this.getConfigValue('REDIS_PORT', '6379');
    this.REDIS_DB = this.getConfigValue('REDIS_DB', '0');
    this.REDIS_USERNAME = this.getConfigValue('REDIS_USERNAME', 'default');
    this.REDIS_PASSWORD = this.getConfigValue('REDIS_PASSWORD', 'password');
    this.PGADMIN_PORT = this.getConfigValue('PGADMIN_PORT', '5050');
    this.PGADMIN_EMAIL = this.getConfigValue('PGADMIN_EMAIL', 'example@mail.ru');
    this.PGADMIN_PASSWORD = this.getConfigValue('PGADMIN_PASSWORD', 'password');
    this.TELEGRAM_BOT_TOKEN = this.getConfigValue('TELEGRAM_BOT_TOKEN', '');
    this.ENCRYPT_KEY = this.getConfigValue('ENCRYPT_KEY', 'sekret');
    this.ANVIL_RPC_URL = this.getConfigValue('ANVIL_RPC_URL', 'http://dex_sniper-anvil:8545');
    this.ANVIL_WS_RPC_URL = this.getConfigValue('ANVIL_WS_RPC_URL', 'ws://dex_sniper-anvil:8545');
    this.POLYGON_RPC_URL = this.getConfigValue('POLYGON_RPC_URL', 'https://polygon-rpc.com/');
    this.POLYGON_WS_RPC_URL = this.getConfigValue('POLYGON_WS_RPC_URL', 'wss://go.getblock.io/');
    this.BSC_RPC_URL = this.getConfigValue('BSC_RPC_URL', 'https://bsc-dataseed.binance.org/');
    this.BSC_WS_RPC_URL = this.getConfigValue('BSC_WS_RPC_URL', 'wss://go.getblock.io/');

    this.notProd = this.NODE_ENV !== 'production';

    this.databaseConfig = {
      type: 'postgres',
      host: this.DB_HOST,
      port: Number(this.DB_PORT),
      username: this.DB_USER,
      password: this.DB_PASSWORD,
      database: this.DB_NAME,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: this.NODE_ENV === 'test',
      dropSchema: this.NODE_ENV === 'test',
    };

    this.chains = {
      [Network.BSC]: {
        name: 'Binance Smart Chain',
        rpcUrl: this.BSC_RPC_URL,
        rpcWsUrl: this.BSC_WS_RPC_URL,
        chain: bsc,
        nativeToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        tokenName: 'BNB',
        tokenSymbol: 'BNB',
        tokenDecimals: 18,
        exchange: 'PancakeSwap',
        routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
      },
      [Network.POLYGON]: {
        name: 'Polygon',
        rpcUrl: this.POLYGON_RPC_URL,
        rpcWsUrl: this.POLYGON_WS_RPC_URL,
        chain: polygon,
        nativeToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        tokenName: 'POL',
        tokenSymbol: 'POL',
        tokenDecimals: 18,
        exchange: 'Uniswap',
        routerAddress: '0xedf6066a2b290C185783862C7F4776A2C8077AD1',
        factoryAddress: '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C',
      },
    };
  }

  private getConfigValue(key: string, defaultValue: string): string {
    const value = this.configService.get<string>(key);
    return value ?? defaultValue;
  }
}
