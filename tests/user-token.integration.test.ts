import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PublicClient } from 'viem';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { User } from '@modules/user/user.entity';
import { UserModule } from '@modules/user/user.module';
import { UserService } from '@modules/user/user.service';
import { UserToken } from '@modules/user-token/user-token.entity';
import { UserTokenModule } from '@modules/user-token/user-token.module';
import { UserTokenService } from '@modules/user-token/user-token.service';
import { RedisService } from '@modules/redis/redis.service';
import { RedisModule } from '@modules/redis/redis.module';
import { ConstantsModule } from '@modules/constants/constants.module';
import { ConstantsProvider } from '@modules/constants/constants.provider';
import { BlockchainModule } from '@modules/blockchain/blockchain.module';
import { ViemProvider } from '@modules/blockchain/viem/viem.provider';
import { AnvilProvider } from '@modules/blockchain/viem/anvil/anvil.provider';
import { ViemHelperProvider } from '@modules/blockchain/viem/viem-helper.provider';
import { BotError } from '@src/errors/BotError';
import { Network, Address, ViemNetwork } from '@src/types/types';
import { ViemClientsType, UnwatchCallback } from '@modules/blockchain/viem/types';

const mockTokenAddress = '0x7ef95a0fee0dd0fcf22c847284d0aa200b06abc6' as Address;
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
  createTestToken: jest.fn(),
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

const mockPairAddresses = {
  pairAddress: '0xPairAddress',
  token0: '0xT0',
  token1: '0xT1',
};

const tokenParams = { name: 'Test Token', symbol: 'TTK', decimals: 18 };

const mockTestToken = {
  id: 1,
  ...tokenParams,
  address: mockTokenAddress,
  network: Network.BSC,
  createdAd: new Date(),
};

describe('UserTokenService Integration', () => {
  let app: INestApplication;
  let userTokenService: UserTokenService;
  let userService: UserService;
  let userRepository: Repository<User>;
  let userTokenRepository: Repository<UserToken>;
  let redisService: RedisService;
  let viemProvider: ViemProvider;
  let constantsProvider: ConstantsProvider;

  const chatId = 123456789;
  const network = Network.BSC;

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
          useFactory: (constants: ConstantsProvider) => constants.databaseConfig,
        }),
        EventEmitterModule.forRoot(),
        RedisModule,
        UserModule,
        UserTokenModule,
        BlockchainModule,
        ConstantsModule,
      ],
    })
      .overrideProvider(AnvilProvider)
      .useValue(mockAnvilProvider)
      .overrideProvider(ViemHelperProvider)
      .useValue(mockViemHelperProvider)
      .compile();

    userTokenService = module.get<UserTokenService>(UserTokenService);
    userService = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    userTokenRepository = module.get<Repository<UserToken>>(getRepositoryToken(UserToken));
    redisService = module.get<RedisService>(RedisService);
    viemProvider = module.get<ViemProvider>(ViemProvider);
    constantsProvider = module.get<ConstantsProvider>(ConstantsProvider);

    viemProvider['unwatchCallbacks'] = mockUnwatchCallbacks;
    viemProvider['clients'] = mockClients;
    mockViemHelperProvider.initAnvil.mockResolvedValue(undefined);
    mockViemHelperProvider.getClients.mockReturnValue(mockClients);
    mockViemHelperProvider.initUnwatchCallbacks.mockReturnValue(mockUnwatchCallbacks);
    mockAnvilProvider.setTestBalance.mockResolvedValue(undefined);
    mockAnvilProvider.createTestToken.mockResolvedValue({
      token: mockTestToken,
      pairAddresses: mockPairAddresses,
    });
    viemProvider.monitorDex = jest.fn().mockResolvedValue(undefined);
    viemProvider.onModuleInit = jest.fn().mockResolvedValue(undefined);
    viemProvider.checkToken = jest.fn().mockResolvedValue({
      ...tokenParams,
      pairAddresses: mockPairAddresses,
    });

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await userRepository.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
    await redisService['redisClient'].flushall();

    const { user } = await userService.getOrCreateUser(chatId);

    await redisService.addUser({
      chatId,
      userId: user!.id,
      action: 'get',
      wallets: [...user!.wallets],
      tokens: [...user!.tokens],
      subscriptions: [...user!.subscriptions],
      replications: [],
    });
  });

  afterAll(async () => {
    await userRepository.query('TRUNCATE TABLE "user" RESTART IDENTITY CASCADE;');
    await redisService['redisClient'].flushall();
    await redisService['redisClient'].quit();
    await app.close();
  });

  describe('addToken', () => {
    it('should add token successfully', async () => {
      const userSession = await redisService.getUser(chatId);

      const result = await userTokenService.addToken({
        userSession,
        address: mockTokenAddress,
        network,
      });

      const testTokens = await redisService.getTokens(chatId, 'testTokens');

      expect(result).toContain('Ваши токены:');
      expect(result).toContain('Test Token (TTK)');

      const tokens = await userTokenRepository.find();
      expect(tokens.length).toBe(1);
      expect(testTokens!.length).toBe(1);
    });

    it('should create only real token (NODE_ENV = production)', async () => {
      Object.defineProperty(constantsProvider, 'notProd', { value: false, configurable: true });

      const userSession = await redisService.getUser(chatId);

      await userTokenService.addToken({
        userSession,
        address: mockTokenAddress,
        network,
      });

      const tokens = await userTokenRepository.find();
      const sessionTokens = await redisService.getTokens(chatId, 'tokens');
      const testTokens = await redisService.getTokens(chatId, 'testTokens');

      expect(tokens).toHaveLength(1);
      expect(sessionTokens).toHaveLength(1);
      expect(testTokens).toBeNull();

      Object.defineProperty(constantsProvider, 'notProd', { value: true, configurable: true });
    });

    it('should throw error when token already exists', async () => {
      const userSessionBefore = await redisService.getUser(chatId);

      await userTokenService.addToken({
        userSession: userSessionBefore,
        address: mockTokenAddress,
        network,
      });

      const userSessionAfter = await redisService.getUser(chatId);

      await userTokenService.addToken({
        userSession: userSessionBefore,
        address: mockTokenAddress,
        network,
      });

      await expect(
        userTokenService.addToken({
          userSession: userSessionAfter,
          address: mockTokenAddress,
          network,
        }),
      ).rejects.toThrow(new BotError('Token already added', 'Токен уже добавлен', 400));
    });

    it('should throw error when add more then 5 tokens', async () => {
      const userSession = await redisService.getUser(chatId);
      userSession.tokens = [mockTestToken, mockTestToken, mockTestToken, mockTestToken, mockTestToken];

      await expect(
        userTokenService.addToken({
          userSession: userSession,
          address: (mockTokenAddress + 'r') as Address,
          network,
        }),
      ).rejects.toThrow(
        new BotError('You can add only 5 tokens per network', 'Максимум можно добавить 5 токенов на одну сеть', 400),
      );
    });
  });

  describe('getTokens', () => {
    it('should return formatted tokens list', async () => {
      const userSessionBefore = await redisService.getUser(chatId);

      await userTokenService.addToken({
        userSession: userSessionBefore,
        address: mockTokenAddress,
        network,
      });

      const result = await userTokenService.getTokens(chatId);
      expect(result).toContain('Ваши токены:');
      expect(result).toContain('Test Token (TTK)');
    });

    it('should throw error when no tokens found', async () => {
      await expect(userTokenService.getTokens(chatId)).rejects.toThrow(
        new BotError('You have no saved tokens', 'У вас нет сохраненных токенов', 404),
      );
    });
  });

  // describe('removeToken', () => {
  //   it('should remove token by address', async () => {
  //     await userTokenService.addToken({
  //       userSession: {
  //         userId: testUser.id,
  //         chatId,
  //         tokens: [],
  //         wallets: [{ network, address: '0xWalletAddress' }],
  //         subscriptions: [],
  //         replications: [],
  //       },
  //       address: mockTokenAddress,
  //       network,
  //     });

  //     await userTokenService.removeToken({ chatId, address: mockTokenAddress });

  //     const tokens = await userTokenRepository.find();
  //     expect(tokens.length).toBe(0);
  //   });

  //   it('should throw error when token not found', async () => {
  //     await expect(userTokenService.removeToken({ chatId, address: mockTokenAddress })).rejects.toThrow(
  //       new BotError('Token not found', 'Токен не найден', 404),
  //     );
  //   });
  // });
});
