import * as path from 'path';
import { PublicClient } from 'viem';
import { Repository } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';

import { User } from '@modules/user/user.entity';
import { UserModule } from '@modules/user/user.module';
import { UserService } from '@modules/user/user.service';
import { RedisService } from '@modules/redis/redis.service';
import { WalletModule } from '@modules/wallet/wallet.module';
import { ViemProvider } from '@modules/blockchain/viem/viem.provider';
import { AnvilProvider } from '@modules/blockchain/viem/anvil/anvil.provider';
import { ViemHelperProvider } from '@modules/blockchain/viem/viem-helper.provider';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { ConstantsModule } from '@modules/constants/constants.module';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { Network, ViemNetwork } from '@src/types/types';
import { UnwatchCallback, ViemClientsType } from '@modules/blockchain/viem/types';

const mockPublicClient = {
  readContract: jest.fn(),
  simulateContract: jest.fn(),
  getBalance: jest.fn(),
  waitForTransactionReceipt: jest.fn(),
} as unknown as PublicClient;

const mockClients = Object.keys(ViemNetwork).reduce(
  (clients, keyNetwork) => {
    clients.public[keyNetwork] = mockPublicClient;
    clients.publicWebsocket[keyNetwork] = mockPublicClient;

    return clients;
  },
  { public: {}, publicWebsocket: {} } as ViemClientsType,
);

const mockUnwatchCallbacks: UnwatchCallback = {
  BSC: () => {},
  POLYGON: () => {},
};

const mockAnvilProvider = {
  createClients: jest.fn(),
  initTestAddresses: jest.fn(),
  initTestDex: jest.fn(),
  setTestBalance: jest.fn(),
};

const mockViemHelperProvider = {
  getClients: jest.fn(),
  initUnwatchCallbacks: jest.fn(),
  getPair: jest.fn(),
  balanceOf: jest.fn(),
  transfer: jest.fn(),
  transferNative: jest.fn(),
  initAnvil: jest.fn(),
  formatBalanceResponse: jest.fn(),
};

describe('UserService Integration', () => {
  let app: INestApplication;
  let userService: UserService;
  let viemProvider: ViemProvider;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: [path.resolve(__dirname, '..', '.env.test')],
          isGlobal: true,
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConstantsModule],
          inject: [ConstantsProvider],
          useFactory: (constants: ConstantsProvider) => {
            return constants.databaseConfig;
          },
        }),
        EventEmitterModule.forRoot(),
        BlockchainModule,
        WalletModule,
        UserModule,
      ],
    })
      .overrideProvider(RedisService)
      .useValue({
        getUser: jest.fn(),
      })
      .overrideProvider(AnvilProvider)
      .useValue(mockAnvilProvider)
      .overrideProvider(ViemHelperProvider)
      .useValue(mockViemHelperProvider)
      .compile();

    userService = module.get<UserService>(UserService);
    viemProvider = module.get<ViemProvider>(ViemProvider);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    viemProvider['unwatchCallbacks'] = mockUnwatchCallbacks;
    viemProvider['clients'] = mockClients;
    mockViemHelperProvider.initAnvil.mockResolvedValue(undefined);
    mockViemHelperProvider.getClients.mockReturnValue(mockClients);
    mockViemHelperProvider.initUnwatchCallbacks.mockReturnValue(mockUnwatchCallbacks);
    mockAnvilProvider.setTestBalance.mockResolvedValue(undefined);
    viemProvider.monitorDex = jest.fn().mockResolvedValue(undefined);
    viemProvider.onModuleInit = jest.fn().mockResolvedValue(undefined);

    console.log('viemPRovider', viemProvider);

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await userRepository.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
  });

  afterAll(async () => {
    await userRepository.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
    await app.close();
  });

  it('should create a new user and wallets if user does not exist', async () => {
    const chatId: number = 123456789;

    const spyCreateWallet = jest.spyOn(viemProvider, 'createWallet');

    const result = await userService.getOrCreateUser(chatId);

    expect(result.action).toBe('create');
    expect(result.user).toBeDefined();
    expect(result.user?.chatId).toBe(`${chatId}`);

    const expectedNetworkCount = Object.keys(Network).length;
    expect(spyCreateWallet).toHaveBeenCalledTimes(expectedNetworkCount);
    Object.values(Network).forEach(network => {
      expect(spyCreateWallet).toHaveBeenCalledWith(network);
    });
  });

  it('should return existing user if already registered', async () => {
    const chatId = 987654321;

    const spyCreateWallet = jest.spyOn(viemProvider, 'createWallet');

    await userService.getOrCreateUser(chatId);
    const expectedNetworkCountOnCreation = Object.keys(Network).length;
    expect(spyCreateWallet).toHaveBeenCalledTimes(expectedNetworkCountOnCreation);

    const result = await userService.getOrCreateUser(chatId);

    expect(result.action).toBe('get');
    expect(result.user).toBeDefined();
    expect(result.user?.chatId).toBe(`${chatId}`);
  });
});
